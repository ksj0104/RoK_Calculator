"""위키에서 건물/연구 데이터와 아이콘을 수집해 web/src/data + web/public/icons 에 저장한다.

사용법: ..\.venv\Scripts\python scrape_wiki.py [--skip-icons]
캐시(.cache/)가 있으면 네트워크 요청 없이 재생성된다.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from rok_wiki.api import fetch_html, fetch_parse
from rok_wiki.icons import download_all_icons
from rok_wiki.parse_buildings import parse_building_table
from rok_wiki.parse_tech import parse_tech_list, parse_tech_table
from rok_wiki.textutil import slugify

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "web" / "src" / "data"

# (위키 페이지 이름, 카테고리) — Buildings 페이지의 진행형 건물 전수
BUILDINGS = [
    ("City Hall", "other"), ("Wall", "other"), ("Watchtower", "other"),
    ("Farm", "economic"), ("Lumber Mill", "economic"), ("Quarry", "economic"),
    ("Goldmine", "economic"), ("Academy", "economic"), ("Storehouse", "economic"),
    ("Alliance Center", "economic"), ("Builder's Hut", "economic"), ("Shop", "economic"),
    ("Trading Post", "economic"), ("Lyceum of Wisdom", "economic"), ("Courier Station", "economic"),
    ("Tavern", "military"), ("Scout Camp", "military"), ("Barracks", "military"),
    ("Archery Range", "military"), ("Stable", "military"), ("Siege Workshop", "military"),
    ("Hospital", "military"), ("Monument", "military"), ("Castle", "military"),
    ("Blacksmith", "military"), ("Bulletin Board", "military"),
]


def _redirect_target(wikitext: str) -> str | None:
    """wikitext가 "#REDIRECT[[Technology/X]]"라면 X를 반환한다 (문명별 병사 명칭이
    공용 연구 페이지로 리다이렉트되는 경우, 예: Legionary -> Long Swordsman)."""
    m = re.match(r"\s*#REDIRECT\s*\[\[Technology/([^\]|]+)\]\]", wikitext, re.IGNORECASE)
    return m.group(1).strip() if m else None


def apply_overrides(entries: list[dict], overrides: dict, section: str) -> None:
    """overrides.json 형식: {"buildings": {"city_hall": {"5": {"timeSec": 3600}}}, "research": {...}}
    id → 레벨(문자열) → 덮어쓸 필드 부분 dict."""
    for entry in entries:
        for level_str, patch in overrides.get(section, {}).get(entry["id"], {}).items():
            for row in entry["levels"]:
                if row["level"] == int(level_str):
                    row.update(patch)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-icons", action="store_true")
    args = parser.parse_args()

    names_en: dict[str, str] = {}
    warnings: list[str] = []

    buildings = []
    for name, category in BUILDINGS:
        bid = slugify(name)
        names_en[bid] = name
        page = f"Buildings/{name.replace(' ', '_')}/Requirements"
        try:
            html = fetch_html(page)
        except Exception:  # noqa: BLE001 - /Requirements 하위 페이지가 없는 건물도 있다
            # 예: Lyceum of Wisdom은 별도 Requirements 페이지 없이 본문에 표가 바로 있다.
            try:
                html = fetch_html(f"Buildings/{name.replace(' ', '_')}")
            except Exception as e2:  # noqa: BLE001
                warnings.append(f"building {bid}: {e2}")
                continue
        try:
            levels = parse_building_table(html, bid, warnings)
        except Exception as e:  # noqa: BLE001 - 수집 도구: 수집 가능한 것부터 저장하고 경고
            warnings.append(f"building {bid}: {e}")
            continue
        buildings.append({"id": bid, "category": category,
                          "maxLevel": max(r["level"] for r in levels), "levels": levels})

    tech_list = parse_tech_list(fetch_parse("Technology")["wikitext"])
    research: list[dict] = []
    research_ids: set[str] = set()
    aliases: list[tuple[str, str]] = []  # (별칭 연구명, 실제 대상 연구명) — 보고용

    def add_research(tech_name: str, tid: str, tree: str, tier: int) -> None:
        page = f"Technology/{tech_name.replace(' ', '_')}"
        levels = parse_tech_table(fetch_html(page), tid, warnings)
        names_en[tid] = tech_name
        research.append({"id": tid, "tree": tree, "tier": tier,
                         "maxLevel": max(r["level"] for r in levels), "levels": levels})
        research_ids.add(tid)

    for tech in tech_list:
        tid = slugify(tech["name"])
        if tid in research_ids:
            continue  # 앞서 다른 문명별 별칭을 통해 이미 이 대상으로 추가됨
        try:
            add_research(tech["name"], tid, tech["tree"], tech["tier"])
            continue
        except Exception as e:  # noqa: BLE001
            first_error = e

        # 표를 못 찾은 경우, 문명별 병사 명칭이 공용 연구 페이지로 가는 위키 리다이렉트인지 확인한다
        # (예: Legionary -> Long Swordsman). 리다이렉트라면 별칭은 건너뛰고 실제 대상만 한 번 수집한다.
        try:
            wikitext = fetch_parse(f"Technology/{tech['name'].replace(' ', '_')}")["wikitext"]
        except Exception:  # noqa: BLE001
            wikitext = ""
        target = _redirect_target(wikitext)
        if target is None:
            names_en[tid] = tech["name"]  # 진짜 실패는 건물과 동일하게 이름은 남겨 둔다
            warnings.append(f"research {tid}: {first_error}")
            continue

        target_id = slugify(target)
        aliases.append((tech["name"], target))
        warnings.append(f"research {tid}: alias of {target_id}")
        if target_id in research_ids:
            continue
        try:
            add_research(target, target_id, tech["tree"], tech["tier"])
        except Exception as e2:  # noqa: BLE001
            warnings.append(f"research {target_id} (via alias {tid}): {e2}")

    overrides_file = DATA_DIR / "overrides.json"
    overrides = json.loads(overrides_file.read_text(encoding="utf-8")) if overrides_file.exists() else {}
    apply_overrides(buildings, overrides, "buildings")
    apply_overrides(research, overrides, "research")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for fname, payload in [("buildings.json", buildings), ("research.json", research),
                           ("names.en.json", names_en)]:
        (DATA_DIR / fname).write_text(
            json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    if not args.skip_icons:
        warnings += download_all_icons(
            [b["id"] for b in buildings], [r["id"] for r in research], names_en,
            ROOT / "web" / "public" / "icons")

    print(f"buildings: {len(buildings)}, research: {len(research)}")
    for w in warnings:
        print(f"WARNING: {w}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
