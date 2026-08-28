"""건물 Requirements 페이지의 렌더링 HTML에서 레벨 테이블을 추출한다.

테이블 구조: class="article-table building-table". 헤더 컬럼은 건물마다 다르지만
Level / Requirements / Cost / Time / Power 는 공통이고 그 외(Unlocks, Troop Capacity 등)는 무시한다.
시대 구분 행(th colspan)은 건너뛴다.
"""
import re

from bs4 import BeautifulSoup

from .textutil import parse_amount, parse_duration, slugify

RESOURCES = ("food", "wood", "stone", "gold")


def _requirements_from_cell(cell) -> list[dict]:
    reqs = []
    # 렌더링된 셀은 "<a>Wall</a> Lv.2<br/><a>Hospital</a> Lv.4" 형태.
    # <br> 기준으로 나눠 각 조각에서 링크 텍스트와 "Lv.N"/"Level N"을 짝짓는다.
    for part in re.split(r"<br\s*/?>", cell.decode_contents()):
        frag = BeautifulSoup(part, "html.parser")
        link = frag.find("a")
        m = re.search(r"(?:Lv\.?|Level)\s*(\d+)", frag.get_text())
        if link and m:
            reqs.append({"type": "building", "id": slugify(link.get_text()), "level": int(m.group(1))})
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


def parse_building_table(html: str, building_id: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="building-table") or soup.find("table", class_="article-table")
    if table is None:
        raise ValueError(f"{building_id}: no building table found")

    header_cells = [th.get_text(" ", strip=True).lower() for th in table.find("tr").find_all("th")]

    def col(name: str) -> int | None:
        for i, h in enumerate(header_cells):
            if name in h:
                return i
        return None

    idx = {name: col(name) for name in ("level", "requirement", "cost", "time", "power")}
    for required in ("level", "cost", "time", "power"):
        if idx[required] is None:
            raise ValueError(f"{building_id}: missing column {required!r} in {header_cells}")

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
        rows.append({
            "level": int(level_text),
            "requirements": _requirements_from_cell(cells[idx["requirement"]]) if idx["requirement"] is not None else [],
            "cost": _cost_from_cell(cells[idx["cost"]]),
            "timeSec": parse_duration(cells[idx["time"]].get_text(" ", strip=True)),
            "power": parse_amount(cells[idx["power"]].get_text(strip=True)),
        })
    rows.sort(key=lambda r: r["level"])
    return rows
