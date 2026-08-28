from pathlib import Path

from rok_wiki.parse_buildings import parse_building_table

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


def test_placeholder_time_value_becomes_zero_with_warning():
    html = _table(
        "<tr><td>1</td><td>None</td><td>None</td><td>?</td><td>5</td></tr>",
        "<th>Level</th><th>Requirements</th><th>Cost</th><th>Time</th><th>Power</th>",
    )
    warnings: list[str] = []
    rows = parse_building_table(html, "blacksmith", warnings)
    assert rows[0]["timeSec"] == 0
    assert any("unknown time value" in w for w in warnings)
