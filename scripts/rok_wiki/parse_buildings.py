"""건물 Requirements 페이지의 렌더링 HTML에서 레벨 테이블을 추출한다.

테이블 구조: class="article-table building-table". 헤더 컬럼은 건물마다 다르지만
Level / Requirements / Cost / Time / Power 는 공통이고 그 외(Unlocks, Troop Capacity 등)는 무시한다.
시대 구분 행(th colspan)은 건너뛴다.
"""
import re

from bs4 import BeautifulSoup

from .textutil import is_placeholder, parse_amount, parse_duration, slugify

RESOURCES = ("food", "wood", "stone", "gold")


def _requirements_from_cell(cell) -> list[dict]:
    reqs = []
    # 렌더링된 셀은 보통 "<a>Wall</a> Lv.2<br/><a>Hospital</a> Lv.4" 형태다. 다만 일부 건물의
    # 최대 레벨 행(Watchtower/Storehouse/Castle 등)은 <br> 대신 <p>로 항목을 구분하고, 첫
    # 항목 이후로는 "Lv."/"Level" 접두어 없이 이름 뒤에 레벨 숫자만 붙는다(예: "Hospital 25").
    # 대상 건물이 위키에 문서가 없으면 <a>가 아니라 <span class="new">(레드링크)로 렌더링되는데,
    # 이를 처리하지 않으면 요구사항이 통째로 누락된다(예: Watchtower가 모든 레벨에서 요구하는
    # "Wall"은 항상 레드링크).
    for part in re.split(r"<br\s*/?>|</?p>", cell.decode_contents()):
        frag = BeautifulSoup(part, "html.parser")
        link = frag.find("a")
        redlink = frag.find("span", class_="new")
        if link is not None:
            name = link.get_text()
        elif redlink is not None:
            name = redlink.get_text()
        else:
            continue
        text = frag.get_text()
        m = re.search(r"(?:Lv\.?|Level)\s*(\d+)", text) or re.search(r"(\d+)\s*$", text.strip())
        if m:
            reqs.append({"type": "building", "id": slugify(name), "level": int(m.group(1))})
    return reqs


def _cost_from_cell(cell) -> dict:
    # BuildingResources 템플릿은 자원 아이콘을 <span typeof="mw:File"><span><img alt="Resource icon food" .../></span></span>
    # 로 감싸고, 수치 텍스트("6.5K")는 img의 부모가 아니라 그 바깥 wrapper span의 형제 텍스트 노드로 온다.
    cost = {r: 0 for r in RESOURCES}
    for img in cell.find_all("img"):
        alt = (img.get("alt") or img.get("data-image-name") or "").lower()
        resource = next((r for r in RESOURCES if r in alt), None)
        if resource is None:
            continue
        wrapper = img.find_parent("span", attrs={"typeof": "mw:File"}) or img.find_parent()
        tail = str(wrapper.next_sibling or "") if wrapper else ""
        m = re.search(r"([\d,.]+\s*[KMB]?)", tail)
        if m:
            cost[resource] = parse_amount(m.group(1))
    return cost


def parse_building_table(html: str, building_id: str, warnings: list[str] | None = None) -> list[dict]:
    if warnings is None:
        warnings = []
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="building-table") or soup.find("table", class_="article-table")
    if table is None:
        raise ValueError(f"{building_id}: no building table found")

    header_cells = [th.get_text(" ", strip=True).lower() for th in table.find("tr").find_all("th")]

    def col(*names: str) -> int | None:
        # 정확 일치를 먼저 찾는다: "Time"이 "Times You Can Be Helped"(Alliance Center 등)에
        # 부분일치되어 잘못된 컬럼을 고르는 것을 막기 위함. 그다음에야 헤더의 개별 단어(부분/복수형
        # 포함, 예: "Lvl"→level, "Requirements"→requirement)를 대상으로 완화된 매칭을 시도한다.
        for i, h in enumerate(header_cells):
            if h in names:
                return i
        for i, h in enumerate(header_cells):
            if any(word == n or word.startswith(n) for n in names for word in h.split()):
                return i
        return None

    idx = {
        "level": col("level", "lvl"),
        "requirement": col("requirement"),
        "cost": col("cost", "resources"),
        "time": col("time"),
        "power": col("power"),
    }
    for required in ("level", "cost", "time"):
        if idx[required] is None:
            raise ValueError(f"{building_id}: missing column {required!r} in {header_cells}")
    if idx["power"] is None:
        warnings.append(f"{building_id}: no power column, defaulting power to 0")

    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:            # 헤더 행 / 시대 구분 행(th만 있음)
            continue
        if len(cells) < len([i for i in idx.values() if i is not None]):
            continue             # 비정상 행은 건너뛰고 validate에서 잡는다
        level_text = cells[idx["level"]].get_text(strip=True)
        if not level_text.isdigit():
            continue
        level = int(level_text)

        time_text = cells[idx["time"]].get_text(" ", strip=True)
        if is_placeholder(time_text):
            warnings.append(f"{building_id} level {level}: unknown time value {time_text!r} on wiki, using 0")

        cost_cell = cells[idx["cost"]]
        if is_placeholder(cost_cell.get_text(" ", strip=True)):
            warnings.append(f"{building_id} level {level}: unknown cost value on wiki, using 0")

        power_text = cells[idx["power"]].get_text(strip=True) if idx["power"] is not None else "0"
        if idx["power"] is not None and is_placeholder(power_text):
            warnings.append(f"{building_id} level {level}: unknown power value {power_text!r} on wiki, using 0")

        rows.append({
            "level": level,
            "requirements": _requirements_from_cell(cells[idx["requirement"]]) if idx["requirement"] is not None else [],
            "cost": _cost_from_cell(cost_cell),
            "timeSec": parse_duration(time_text),
            "power": parse_amount(power_text),
        })
    rows.sort(key=lambda r: r["level"])
    return rows
