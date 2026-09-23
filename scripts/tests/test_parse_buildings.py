from pathlib import Path

from bs4 import BeautifulSoup

from rok_wiki.parse_buildings import _requirements_from_cell, parse_building_table

HTML = (Path(__file__).parent / "fixtures" / "city_hall_requirements.html").read_text(encoding="utf-8")


def _table(rows_html: str, headers: str) -> str:
    return f'<table class="building-table"><tr>{headers}</tr>{rows_html}</table>'


def test_city_hall_has_25_levels():
    rows = parse_building_table(HTML, "city_hall")
    assert [r["level"] for r in rows] == list(range(1, 26))


def test_level1_is_free():
    row = parse_building_table(HTML, "city_hall")[0]
    assert row["cost"] == {"food": 0, "wood": 0, "stone": 0, "gold": 0}
    assert row["timeSec"] == 0
    assert row["requirements"] == []


def test_level3_requires_wall2():
    row = parse_building_table(HTML, "city_hall")[2]
    assert {"type": "building", "id": "wall", "level": 2} in row["requirements"]
    assert row["cost"]["food"] == 6500 and row["cost"]["wood"] == 6500
    assert row["timeSec"] == 300
    assert row["power"] == 59


def test_level10_two_requirements():
    row = parse_building_table(HTML, "city_hall")[9]
    assert {"type": "building", "id": "wall", "level": 9} in row["requirements"]
    assert {"type": "building", "id": "academy", "level": 9} in row["requirements"]


def test_lvl_header_alias():
    # Academy 페이지는 "Level"이 아니라 "Lvl"을 쓴다.
    html = _table(
        "<tr><td>1</td><td>None</td><td>None</td><td>10s</td><td>5</td></tr>",
        "<th>Lvl</th><th>Requirements</th><th>Cost</th><th>Time</th><th>Power</th>",
    )
    rows = parse_building_table(html, "academy")
    assert rows[0]["level"] == 1


def test_resources_header_alias_for_cost():
    # Watchtower 페이지는 "Cost"가 아니라 "Resources"를 쓴다.
    html = _table(
        "<tr><td>1</td><td>None</td><td>None</td><td>10s</td><td>5</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Resources</th><th>Time</th><th>Power</th>",
    )
    rows = parse_building_table(html, "watchtower")
    assert rows[0]["cost"] == {"food": 0, "wood": 0, "stone": 0, "gold": 0}


def test_time_column_not_confused_with_similarly_named_column():
    # Alliance Center: "Time" 앞에 "Times You Can Be Helped"가 있으면 부분일치로 그 컬럼을
    # 잘못 고를 수 있다 — 정확 일치가 우선이어야 한다.
    html = _table(
        "<tr><td>1</td><td>None</td><td>5</td><td>None</td><td>1h</td><td>10</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Times You Can Be Helped</th>"
        "<th>Cost</th><th>Time</th><th>Power</th>",
    )
    rows = parse_building_table(html, "alliance_center")
    assert rows[0]["timeSec"] == 3600


def test_missing_power_column_defaults_to_zero_with_warning():
    html = _table(
        "<tr><td>1</td><td>None</td><td>None</td><td>10s</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Cost</th><th>Time</th>",
    )
    warnings: list[str] = []
    rows = parse_building_table(html, "no_power_building", warnings)
    assert rows[0]["power"] == 0
    assert any("power" in w for w in warnings)


def test_requirements_p_separated_cell_with_redlink_and_bare_number():
    # Watchtower Lv25: <p>로 구분되고, 두 항목 다 "Lv."/"Level" 접두어 없이 이름 뒤에 레벨
    # 숫자만 붙는다. 두 번째 항목(Wall)은 위키에 문서가 없어 레드링크로 렌더링된다 — 둘 다
    # 놓치지 않고 파싱되어야 한다 (과거: <br>만 분할 + 레드링크 미처리로 완전히 누락됨).
    cell = BeautifulSoup(
        '<td>\n<p><b><a href="/wiki/Storehouse" title="Storehouse">Storehouse</a></b> 25\n</p>'
        '<p><b><span class="new" title="Wall (page does not exist)">Wall</span></b> 25\n</p></td>',
        "html.parser",
    ).find("td")
    reqs = _requirements_from_cell(cell)
    assert {"type": "building", "id": "storehouse", "level": 25} in reqs
    assert {"type": "building", "id": "wall", "level": 25} in reqs
    assert len(reqs) == 2


def test_requirements_mixed_lv_prefix_and_bare_number_in_p_cell():
    # Storehouse Lv25: 첫 항목은 "Lv. 25" 접두어가 있고, <p> 뒤 두 번째 항목(레드링크)은
    # 접두어 없이 숫자만 있다.
    cell = BeautifulSoup(
        '<td><b><a class="mw-redirect" href="/wiki/City_Hall" title="City Hall">City Hall</a></b>'
        ' Lv. 25\n<p><b><span class="new" title="Hospital (page does not exist)">Hospital</span></b>'
        " 25\n</p></td>",
        "html.parser",
    ).find("td")
    reqs = _requirements_from_cell(cell)
    assert {"type": "building", "id": "city_hall", "level": 25} in reqs
    assert {"type": "building", "id": "hospital", "level": 25} in reqs


def test_placeholder_time_value_becomes_zero_with_warning():
    html = _table(
        "<tr><td>1</td><td>None</td><td>None</td><td>?</td><td>5</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Cost</th><th>Time</th><th>Power</th>",
    )
    warnings: list[str] = []
    rows = parse_building_table(html, "blacksmith", warnings)
    assert rows[0]["timeSec"] == 0
    assert any("unknown time value" in w for w in warnings)


def test_unrecognized_requirement_cell_warns():
    # 위키가 Requirements 칸을 "?"(Scout Camp)나 "0"(Alliance Center)으로 비워 두면 선행 조건이
    # 조용히 사라진다. 경고로 드러나야 overrides.json 보정 대상임을 알 수 있다.
    html = _table(
        "<tr><td>7</td><td>?</td><td>None</td><td>1h</td><td>5</td></tr>"
        "<tr><td>8</td><td>0</td><td>None</td><td>1h</td><td>5</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Cost</th><th>Time</th><th>Power</th>",
    )
    warnings: list[str] = []
    rows = parse_building_table(html, "scout_camp", warnings)
    assert [r["requirements"] for r in rows] == [[], []]
    assert [w for w in warnings if "unrecognized requirement cell" in w] == [
        "scout_camp level 7: unrecognized requirement cell '?' on wiki, treating as none",
        "scout_camp level 8: unrecognized requirement cell '0' on wiki, treating as none",
    ]


def test_empty_requirement_cell_does_not_warn():
    # 위키가 "None"/"-"로 없음을 명시한 칸은 정상이므로 경고하지 않는다 (예: Trading Post 2~9).
    html = _table(
        "<tr><td>2</td><td>-</td><td>None</td><td>1h</td><td>5</td></tr>"
        "<tr><td>3</td><td>None</td><td>None</td><td>1h</td><td>5</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Cost</th><th>Time</th><th>Power</th>",
    )
    warnings: list[str] = []
    parse_building_table(html, "trading_post", warnings)
    assert not [w for w in warnings if "unrecognized requirement cell" in w]
