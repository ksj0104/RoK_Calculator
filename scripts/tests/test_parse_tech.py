from pathlib import Path

from bs4 import BeautifulSoup

from rok_wiki.parse_tech import _requirements_from_cell, parse_tech_list, parse_tech_table

FIX = Path(__file__).parent / "fixtures"


def test_tech_list_contains_known_techs():
    techs = parse_tech_list((FIX / "technology_list.txt").read_text(encoding="utf-8"))
    by_name = {t["name"]: t for t in techs}
    assert by_name["Masonry"]["tree"] == "economic"
    assert by_name["Masonry"]["tier"] == 3
    assert "Engineering" in by_name
    # 군사 트리도 잡히는지 (Technology 페이지의 두 번째 ItemBlock)
    assert any(t["tree"] == "military" for t in techs)


def test_masonry_table():
    rows = parse_tech_table((FIX / "masonry.html").read_text(encoding="utf-8"), "masonry")
    assert len(rows) == 5
    lv1 = rows[0]
    assert {"type": "research", "id": "irrigation", "level": 1} in lv1["requirements"]
    assert {"type": "building", "id": "academy", "level": 5} in lv1["requirements"]
    assert lv1["cost"] == {"food": 20000, "wood": 20000, "stone": 15000, "gold": 0}
    assert lv1["timeSec"] == 3600
    assert lv1["power"] == 269
    lv2 = rows[1]
    assert {"type": "research", "id": "masonry", "level": 1} in lv2["requirements"]


def test_missing_power_column_defaults_to_zero_with_warning():
    html = (
        '<table class="tech-table"><tr><th>Level</th><th>Requirements</th><th>Cost</th>'
        "<th>Time</th></tr>"
        "<tr><td>1</td><td>None</td><td>None</td><td>10s</td></tr></table>"
    )
    warnings: list[str] = []
    rows = parse_tech_table(html, "no_power_tech", warnings)
    assert rows[0]["power"] == 0
    assert any("power" in w for w in warnings)


def test_placeholder_time_value_becomes_zero_with_warning():
    # 일부 연구는 위키에 시간이 아직 "?"로만 적혀 있다 (예: Stone Saw, Machinery).
    html = (
        '<table class="tech-table"><tr><th>Level</th><th>Requirements</th><th>Cost</th>'
        "<th>Time</th><th>Power</th></tr>"
        "<tr><td>1</td><td>None</td><td>None</td><td>?</td><td>5</td></tr></table>"
    )
    warnings: list[str] = []
    rows = parse_tech_table(html, "stone_saw", warnings)
    assert rows[0]["timeSec"] == 0
    assert any("unknown time value" in w for w in warnings)


def test_requirements_redlink_kind_by_identity_not_markup_shape():
    # 레드링크(<span class="new">)로 렌더링된다는 것만으로 building이 되어서는 안 된다.
    # Academy는 building, 미작성 tech 페이지는 여전히 research여야 한다.
    cell = BeautifulSoup(
        '<td><b><span class="new" title="Some Future Tech (page does not exist)">'
        "Some Future Tech</span></b> Level 2<br />"
        '<b><span class="new" title="Academy (page does not exist)">Academy</span></b> Level 5'
        "</td>",
        "html.parser",
    ).find("td")
    reqs = _requirements_from_cell(cell)
    assert {"type": "research", "id": "some_future_tech", "level": 2} in reqs
    assert {"type": "building", "id": "academy", "level": 5} in reqs


def test_requirements_building_link_with_page_title_as_text():
    # 일부 페이지에서는 building 요구사항 링크의 텍스트가 건물명이 아니라 위키 문서 제목
    # 전체("Buildings/Academy")로 렌더링된다. 텍스트를 그대로 slugify하면 "buildings_academy"
    # 라는 잘못된 id가 되므로, href의 실제 페이지명("Academy")에서 뽑아야 한다.
    cell = BeautifulSoup(
        '<td><b><a href="/wiki/Buildings/Academy" title="Buildings/Academy">'
        "Buildings/Academy</a></b> Level 1</td>",
        "html.parser",
    ).find("td")
    reqs = _requirements_from_cell(cell)
    assert reqs == [{"type": "building", "id": "academy", "level": 1}]


def test_requirements_cell_split_on_p_tags_not_only_br():
    # Combined Arms처럼 요구사항이 <br>이 아니라 <p>로 구분된 셀에서, 서로 다른 두 요구사항의
    # 이름과 레벨이 하나로 뒤섞이면 안 된다 (과거: 첫 "Level N"과 유일한 <a>가 잘못 짝지어짐).
    cell = BeautifulSoup(
        '<td><b><span class="new" title="Academy (page does not exist)">Academy</span></b>'
        " Level 24"
        '<p><b><a href="/wiki/Technology/Camouflage" title="Technology/Camouflage">'
        "Camouflage</a></b> Level 5</p></td>",
        "html.parser",
    ).find("td")
    reqs = _requirements_from_cell(cell)
    assert {"type": "building", "id": "academy", "level": 24} in reqs
    assert {"type": "research", "id": "camouflage", "level": 5} in reqs
    assert len(reqs) == 2
