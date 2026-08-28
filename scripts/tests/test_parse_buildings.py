from pathlib import Path

from rok_wiki.parse_buildings import parse_building_table

HTML = (Path(__file__).parent / "fixtures" / "city_hall_requirements.html").read_text(encoding="utf-8")


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
