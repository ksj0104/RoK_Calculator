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
    # 두 경우 모두 href가 없으므로 태그 종류만으로는 research/building을 구분할 수 없다
    # (레드링크는 Academy 외의 미작성 tech 페이지에서도 나타날 수 있고, <a>도 항상
    # "/Technology/Name" 형태는 아닐 수 있다). 따라서 markup 모양이 아니라 해석된 이름
    # (slug)과 href로 판단한다: building은 href에 "/Buildings/"가 있거나 slug가
    # "academy"인 경우로 한정하고, 그 외(selflink, 레드링크, 그 외 <a>)는 전부 research다.
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
        elif selflink is not None:
            name = selflink.get_text()
            href = ""
        elif redlink is not None:
            name = redlink.get_text()
            href = ""
        else:
            continue
        slug = slugify(name)
        kind = "building" if ("/Buildings/" in href or slug == "academy") else "research"
        reqs.append({"type": kind, "id": slug, "level": int(m.group(1))})
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
