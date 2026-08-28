"""Technology 페이지(위키텍스트)에서 연구 목록을, 개별 연구 페이지(HTML)에서 레벨 테이블을 추출."""
import re

from bs4 import BeautifulSoup

from .parse_buildings import _cost_from_cell  # 동일한 BuildingResources 렌더링
from .textutil import parse_amount, parse_duration, slugify


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
    # 두 경우 모두 href가 없으므로 <a> 유무가 아니라 태그 종류로 research/building을 구분한다.
    for part in re.split(r"<br\s*/?>", cell.decode_contents()):
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
            kind = "research" if "/Technology/" in href else "building"
        elif selflink is not None:
            name = selflink.get_text()
            kind = "research"
        elif redlink is not None:
            name = redlink.get_text()
            kind = "building"
        else:
            continue
        reqs.append({"type": kind, "id": slugify(name), "level": int(m.group(1))})
    return reqs


def parse_tech_table(html: str, tech_id: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="tech-table") or soup.find("table", class_="article-table")
    if table is None:
        raise ValueError(f"{tech_id}: no tech table found")

    header_cells = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]

    def col(name: str) -> int | None:
        for i, h in enumerate(header_cells):
            if name in h:
                return i
        return None

    idx = {name: col(name) for name in ("level", "requirement", "cost", "time", "power")}
    for required in ("level", "cost", "time", "power"):
        if idx[required] is None:
            raise ValueError(f"{tech_id}: missing column {required!r} in {header_cells}")

    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        level_text = cells[idx["level"]].get_text(strip=True)
        if not level_text.isdigit():
            continue
        rows.append({
            "level": int(level_text),
            "requirements": _requirements_from_cell(cells[idx["requirement"]]) if idx["requirement"] is not None else [],
            "cost": _cost_from_cell(cells[idx["cost"]]),
            "timeSec": parse_duration(cells[idx["time"]].get_text(" ", strip=True)),
            "power": parse_amount(cells[idx["power"]].get_text(strip=True)),
        })
    rows.sort(key=lambda r: r["level"])
    return rows
