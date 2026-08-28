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
