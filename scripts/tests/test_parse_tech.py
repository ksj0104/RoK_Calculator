from pathlib import Path

from rok_wiki.parse_tech import parse_tech_list, parse_tech_table

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
