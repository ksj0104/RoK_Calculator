from scrape_wiki import apply_overrides, resolve_research

_LEVEL = [{"level": 1, "requirements": [], "cost": {}, "timeSec": 10, "power": 1}]
_PARSED = {"levels": _LEVEL, "effectName": None}


def test_resolve_research_passes_effect_name_through():
    tech_list = [{"name": "Masonry", "tree": "economic", "tier": 3}]

    def parse_one(name):
        return {"levels": _LEVEL, "effectName": "Building Speed"}

    def fetch_wikitext(name):
        raise AssertionError("호출되면 안 됨")

    research, _names, _aliases = resolve_research(tech_list, parse_one, fetch_wikitext, [])
    assert research[0]["effectName"] == "Building Speed"


def test_apply_overrides_effect_name_and_level_patch():
    entries = [{"id": "jewelry", "effectName": None,
                "levels": [{"level": 1, "timeSec": 10}]}]
    overrides = {"research": {"jewelry": {
        "effectName": "Gem Gathering Unlock",
        "1": {"timeSec": 20},
    }}}
    apply_overrides(entries, overrides, "research")
    assert entries[0]["effectName"] == "Gem Gathering Unlock"
    assert entries[0]["levels"][0]["timeSec"] == 20


def test_alias_after_target_no_duplicate():
    # Long Swordsman(대상)이 Legionary(별칭)보다 먼저 tech_list에 나오는 경우.
    tech_list = [
        {"name": "Long Swordsman", "tree": "military", "tier": 5},
        {"name": "Legionary", "tree": "military", "tier": 5},
    ]

    def parse_one(name):
        if name == "Long Swordsman":
            return _PARSED
        raise ValueError(f"{name}: no tech table found")  # Legionary는 리다이렉트 stub이라 표가 없다

    def fetch_wikitext(name):
        assert name == "Legionary"
        return "#REDIRECT[[Technology/Long Swordsman]]"

    warnings = []
    research, names_en, aliases = resolve_research(tech_list, parse_one, fetch_wikitext, warnings)

    assert [r["id"] for r in research] == ["long_swordsman"]
    assert aliases == [("Legionary", "Long Swordsman")]
    assert any("alias of long_swordsman" in w for w in warnings)
    assert "legionary" not in names_en


def test_alias_before_target_parsed_once_with_alias_tree_tier():
    # Legionary(별칭)가 Long Swordsman(대상)보다 먼저 tech_list에 나오는 경우 — 대상을
    # 별칭 시점에 별칭의 tree/tier로 수집하고, 대상 자신의 (다른) tree/tier로는 중복 수집하지 않는다.
    tech_list = [
        {"name": "Legionary", "tree": "military", "tier": 5},
        {"name": "Long Swordsman", "tree": "economic", "tier": 99},  # 자기 항목의 tree/tier는 무시돼야 함
    ]

    def parse_one(name):
        if name == "Legionary":
            raise ValueError("legionary: no tech table found")
        return _PARSED

    def fetch_wikitext(name):
        assert name == "Legionary"
        return "#REDIRECT[[Technology/Long Swordsman]]"

    warnings = []
    research, names_en, aliases = resolve_research(tech_list, parse_one, fetch_wikitext, warnings)

    assert len(research) == 1
    assert research[0]["id"] == "long_swordsman"
    assert research[0]["tree"] == "military"
    assert research[0]["tier"] == 5
    assert names_en["long_swordsman"] == "Long Swordsman"
    assert "legionary" not in names_en


def test_non_redirect_tech_unaffected():
    tech_list = [{"name": "Masonry", "tree": "economic", "tier": 3}]
    calls = []

    def parse_one(name):
        calls.append(name)
        return _PARSED

    def fetch_wikitext(name):
        raise AssertionError("리다이렉트 확인은 parse_one이 실패했을 때만 호출돼야 한다")

    warnings = []
    research, names_en, aliases = resolve_research(tech_list, parse_one, fetch_wikitext, warnings)

    assert calls == ["Masonry"]
    assert [r["id"] for r in research] == ["masonry"]
    assert aliases == []
    assert warnings == []


def test_genuine_failure_is_not_mistaken_for_alias():
    # 리다이렉트가 아닌 진짜 실패(예: 페이지 자체가 없음)는 별칭 처리 없이 경고만 남긴다.
    tech_list = [{"name": "Nonexistent Tech", "tree": "economic", "tier": 1}]

    def parse_one(name):
        raise ValueError("nonexistent_tech: no tech table found")

    def fetch_wikitext(name):
        raise RuntimeError("page does not exist")

    warnings = []
    research, names_en, aliases = resolve_research(tech_list, parse_one, fetch_wikitext, warnings)

    assert research == []
    assert aliases == []
    assert names_en == {"nonexistent_tech": "Nonexistent Tech"}
    assert any("nonexistent_tech" in w for w in warnings)
