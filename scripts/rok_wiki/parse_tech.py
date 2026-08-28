"""Technology 페이지(위키텍스트)에서 연구 목록을, 개별 연구 페이지(HTML)에서 레벨 테이블을 추출."""
import re

from bs4 import BeautifulSoup

from .parse_buildings import _cost_from_cell  # 동일한 BuildingResources 렌더링
from .textutil import is_placeholder, parse_amount, parse_duration, slugify


def parse_tech_list(wikitext: str) -> list[dict]:
    techs = []
    # Economic / Military ItemBlock 두 덩어리. header= 줄로 분할해 현재 트리를 추적한다.
    tree = None
    tier = 0
    for line in wikitext.splitlines():
        h = re.search(r"header=.*?(Economic|Military) Technology", line)
        if h:
            tree = h.group(1).lower()
            continue
        t = re.search(r"<h3>\s*Tier\s*(\d+)\s*</h3>", line)
        if t:
            tier = int(t.group(1))
            continue
        for name in re.findall(r"\{\{BlockGalleryItemTech\|([^}|]+)", line):
            if tree:
                techs.append({"name": name.strip(), "tree": tree, "tier": tier})
    return techs


def _requirements_from_cell(cell) -> list[dict]:
    reqs = []
    # 렌더링된 셀은 "<a>Irrigation</a> Level 1<br/><span class="new">Academy</span> Level 5" 형태.
    # Academy는 위키에 페이지가 없어 <a>가 아니라 <span class="new">(레드링크)로 렌더링되고,
    # 연구 자기 자신을 가리키는 요구사항은 <a>가 아니라 <strong class="mw-selflink">로 렌더링된다.
    # 두 경우 모두 href가 없으므로 태그 종류만으로는 research/building을 구분할 수 없다
    # (레드링크는 Academy 외의 미작성 tech 페이지에서도 나타날 수 있고, <a>도 항상
    # "/Technology/Name" 형태는 아닐 수 있다). 따라서 markup 모양이 아니라 해석된 이름
    # (slug)과 href로 판단한다: building은 href에 "/Buildings/"가 있거나 slug가
    # "academy"인 경우로 한정하고, 그 외(selflink, 레드링크, 그 외 <a>)는 전부 research다.
    # 일부 페이지는 요구사항을 <br>이 아니라 <p>로 구분한다 (예: Combined Arms) — 둘 다로 분할해야
    # 서로 다른 요구사항의 이름과 레벨이 한 조각으로 뒤섞이지 않는다.
    for part in re.split(r"<br\s*/?>|</?p>", cell.decode_contents()):
        frag = BeautifulSoup(part, "html.parser")
        m = re.search(r"(?:Lv\.?|Level)\s*(\d+)", frag.get_text())
        if not m:
            continue
        link = frag.find("a")
        selflink = frag.find("strong", class_="mw-selflink")
        redlink = frag.find("span", class_="new")
        if link is not None:
            name = link.get_text()
            href = link.get("href") or ""
        elif selflink is not None:
            name = selflink.get_text()
            href = ""
        elif redlink is not None:
            name = redlink.get_text()
            href = ""
        else:
            continue
        # 건물 링크는 href가 "/Buildings/<Page>" 형태다. 링크 텍스트는 보통 건물명 그대로지만
        # (예: "Academy"는 "Buildings/Academy"로) 페이지 제목 전체를 텍스트로 쓰는 경우가 있어
        # 그 경우 텍스트를 그대로 slugify하면 "buildings_academy" 같은 잘못된 id가 된다.
        # href에서 실제 페이지명을 뽑아 사용하면 텍스트 표기와 무관하게 안정적이다.
        if "/Buildings/" in href:
            page = href.split("/Buildings/", 1)[1].split("#", 1)[0]
            slug = slugify(page.replace("_", " "))
            kind = "building"
        else:
            slug = slugify(name)
            kind = "building" if slug == "academy" else "research"
        reqs.append({"type": kind, "id": slug, "level": int(m.group(1))})
    return reqs


def _find_tech_table(soup):
    return soup.find("table", class_="tech-table") or soup.find("table", class_="article-table")


def _column_indices(header_cells: list[str]) -> dict[str, int | None]:
    def col(*names: str) -> int | None:
        # 정확 일치 우선 — parse_buildings.parse_building_table의 col()과 동일한 이유
        # (부분일치만 쓰면 예: "Time"이 다른 헤더에 잘못 매치될 수 있다).
        for i, h in enumerate(header_cells):
            if h in names:
                return i
        for i, h in enumerate(header_cells):
            if any(word == n or word.startswith(n) for n in names for word in h.split()):
                return i
        return None

    return {
        "level": col("level", "lvl"),
        "requirement": col("requirement"),
        "cost": col("cost", "resources"),
        "time": col("time"),
        "power": col("power"),
    }


def _effect_index(header_cells: list[str], idx: dict[str, int | None]) -> int | None:
    """알려진 컬럼(레벨/요구/비용/시간/파워)에 배정되지 않은 첫 헤더가 효과 컬럼이다
    (예: "Building Speed", "Siege Unit Attack"). 병종 해금 연구는 효과 컬럼이 없다."""
    claimed = {i for i in idx.values() if i is not None}
    for i in range(len(header_cells)):
        if i not in claimed:
            return i
    return None


def parse_tech_effect_name(html: str) -> str | None:
    """연구 표의 효과 컬럼 헤더명(원문 표기)을 반환한다. 효과 컬럼이 없으면 None."""
    soup = BeautifulSoup(html, "html.parser")
    table = _find_tech_table(soup)
    if table is None:
        return None
    headers_raw = [th.get_text(" ", strip=True) for th in table.find_all("th")]
    header_cells = [h.lower() for h in headers_raw]
    i = _effect_index(header_cells, _column_indices(header_cells))
    return headers_raw[i] if i is not None else None


def parse_tech_table(html: str, tech_id: str, warnings: list[str] | None = None) -> list[dict]:
    if warnings is None:
        warnings = []
    soup = BeautifulSoup(html, "html.parser")
    table = _find_tech_table(soup)
    if table is None:
        raise ValueError(f"{tech_id}: no tech table found")

    header_cells = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]
    idx = _column_indices(header_cells)
    effect_idx = _effect_index(header_cells, idx)
    for required in ("level", "cost", "time"):
        if idx[required] is None:
            raise ValueError(f"{tech_id}: missing column {required!r} in {header_cells}")
    if idx["power"] is None:
        warnings.append(f"{tech_id}: no power column, defaulting power to 0")

    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        level_text = cells[idx["level"]].get_text(strip=True)
        if not level_text.isdigit():
            continue
        level = int(level_text)

        time_text = cells[idx["time"]].get_text(" ", strip=True)
        if is_placeholder(time_text):
            warnings.append(f"{tech_id} level {level}: unknown time value {time_text!r} on wiki, using 0")

        cost_cell = cells[idx["cost"]]
        if is_placeholder(cost_cell.get_text(" ", strip=True)):
            warnings.append(f"{tech_id} level {level}: unknown cost value on wiki, using 0")

        power_text = cells[idx["power"]].get_text(strip=True) if idx["power"] is not None else "0"
        if idx["power"] is not None and is_placeholder(power_text):
            warnings.append(f"{tech_id} level {level}: unknown power value {power_text!r} on wiki, using 0")

        row = {
            "level": level,
            "requirements": _requirements_from_cell(cells[idx["requirement"]]) if idx["requirement"] is not None else [],
            "cost": _cost_from_cell(cost_cell),
            "timeSec": parse_duration(time_text),
            "power": parse_amount(power_text),
        }
        if effect_idx is not None and len(cells) > effect_idx:
            effect_text = cells[effect_idx].get_text(" ", strip=True)
            if effect_text:
                row["effect"] = effect_text
        rows.append(row)
    rows.sort(key=lambda r: r["level"])
    return rows
