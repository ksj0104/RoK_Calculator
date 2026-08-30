"""수집된 데이터의 정합성 검증. 위반 시 exit 1 (CI 게이트).

검사 항목:
1. 모든 requirement가 존재하는 id/레벨을 가리킨다
2. (id, level) 그래프에 순환이 없다 (Kahn)
3. 레벨은 1..maxLevel 연속
4. 시간/비용/파워 음수 없음
5. 모든 id에 아이콘 파일 존재

추가로 위키 원문이 "?"/"???" placeholder이거나(KNOWN_ZERO_PLACEHOLDERS) 최대 레벨에서만
단조 증가가 갑자기 0으로 끊기는 데이터 누락(KNOWN_DATA_GAPS)이라 0으로 파싱된 값들은
비치명적 WARNING으로만 출력한다 (exit 코드에 영향 없음).
"""
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "src" / "data"
ICONS = ROOT / "web" / "public" / "icons"

# 위키에 "?"/"???"로 명시된 placeholder라 0으로 파싱된 (kind, id, level, field) 목록
# (scrape_wiki.py 실행 시 "unknown ... value" 경고로 확인됨). academy/scout_camp/blacksmith는
# building이지 research가 아니다 — 리뷰에서 지적된 오류.
KNOWN_ZERO_PLACEHOLDERS = {
    ("building", "academy", 25, "timeSec"),
    ("building", "scout_camp", 25, "timeSec"),
    ("building", "scout_camp", 25, "cost"),
    ("building", "blacksmith", 1, "power"),
    ("research", "stone_saw", 10, "timeSec"),
    ("research", "machinery", 10, "timeSec"),
    ("research", "shaft_mining", 10, "timeSec"),
    ("research", "ballistics", 10, "timeSec"),
    ("research", "pavise", 10, "timeSec"),
    ("research", "pavise", 10, "cost"),
    ("research", "plate_armor", 10, "timeSec"),
    ("research", "heavy_frame", 10, "timeSec"),
    ("research", "heavy_frame", 10, "cost"),
}

# 위키가 "?"로 명시하진 않았지만(빈 셀이거나 리터럴 "0") 같은 건물의 다른 레벨들이 뚜렷하게
# 단조 증가하다가 오직 이 레벨(전부 최대 레벨)에서만 0으로 끊기는, 데이터 누락으로 사실상
# 확실한 케이스. (부록: 이전 레벨까지의 시퀀스를 직접 확인해 근거로 삼음 — 예: storehouse
# timeSec 20..24레벨 176400 -> 583200 계속 증가하다 25에서 돌연 0.) "None"(power 0)처럼
# 위키가 의도적으로 0을 명시한 경우와는 구별된다.
KNOWN_DATA_GAPS = {
    ("building", "storehouse", 25, "timeSec"),
    ("building", "alliance_center", 25, "timeSec"),
    ("building", "archery_range", 25, "timeSec"),
    ("building", "siege_workshop", 25, "timeSec"),
    ("building", "siege_workshop", 25, "cost"),
    ("building", "hospital", 25, "timeSec"),
}

KNOWN_ZERO_WARNINGS = KNOWN_ZERO_PLACEHOLDERS | KNOWN_DATA_GAPS


def main() -> int:
    buildings = json.loads((DATA / "buildings.json").read_text(encoding="utf-8"))
    research = json.loads((DATA / "research.json").read_text(encoding="utf-8"))
    troops = json.loads((DATA / "troops.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []

    catalog = {("building", b["id"]): b for b in buildings}
    catalog.update({("research", r["id"]): r for r in research})

    # Troop catalog: four facilities, five tiers, complete non-negative costs.
    expected_tiers = {str(tier) for tier in range(1, 6)}
    expected_resources = {"food", "wood", "stone", "gold"}
    if len(troops.get("facilityCapacity", [])) != 25:
        errors.append("troops: facilityCapacity must contain levels 1..25")
    elif any(value <= 0 for value in troops["facilityCapacity"]):
        errors.append("troops: facilityCapacity values must be positive")
    if set(troops.get("tiers", {})) != expected_tiers:
        errors.append("troops: tiers must contain T1..T5")
    for tier_id, tier in troops.get("tiers", {}).items():
        if any(tier.get(field, 0) <= 0 for field in ("power", "timeSec", "academyLevel")):
            errors.append(f"troops:T{tier_id}: power, timeSec, and academyLevel must be positive")
    for troop_type, troop in troops.get("types", {}).items():
        if ("building", troop.get("facility")) not in catalog:
            errors.append(f"troops:{troop_type}: unknown facility {troop.get('facility')}")
        if set(troop.get("costs", {})) != expected_tiers:
            errors.append(f"troops:{troop_type}: costs must contain T1..T5")
        for tier_id, cost in troop.get("costs", {}).items():
            if set(cost) != expected_resources or any(value < 0 for value in cost.values()):
                errors.append(f"troops:{troop_type}:T{tier_id}: invalid resource cost")
    if set(troops.get("types", {})) != {"infantry", "archer", "cavalry", "siege"}:
        errors.append("troops: types must contain infantry, archer, cavalry, and siege")
    for item in troops.get("shopSpeedups", []):
        if item.get("minutes", 0) <= 0 or item.get("gems", 0) <= 0:
            errors.append("troops: Shop speedup minutes and gems must be positive")

    # 1, 3, 4
    for (kind, cid), entry in catalog.items():
        levels = [row["level"] for row in entry["levels"]]
        if levels != list(range(1, entry["maxLevel"] + 1)):
            errors.append(f"{kind}:{cid}: non-contiguous levels {levels}")
        for row in entry["levels"]:
            if row["timeSec"] < 0:
                errors.append(f"{kind}:{cid}:{row['level']}: negative timeSec")
            elif row["timeSec"] == 0 and (kind, cid, row["level"], "timeSec") in KNOWN_ZERO_WARNINGS:
                warnings.append(f"{kind}:{cid}:{row['level']}: timeSec=0 (known wiki data gap)")

            if row["power"] < 0:
                errors.append(f"{kind}:{cid}:{row['level']}: negative power")
            elif row["power"] == 0 and (kind, cid, row["level"], "power") in KNOWN_ZERO_WARNINGS:
                warnings.append(f"{kind}:{cid}:{row['level']}: power=0 (known wiki data gap)")

            if any(v < 0 for v in row["cost"].values()):
                errors.append(f"{kind}:{cid}:{row['level']}: negative cost")
            elif (kind, cid, row["level"], "cost") in KNOWN_ZERO_WARNINGS and all(v == 0 for v in row["cost"].values()):
                warnings.append(f"{kind}:{cid}:{row['level']}: cost=0 (known wiki data gap)")

            for req in row["requirements"]:
                target = catalog.get((req["type"], req["id"]))
                if target is None:
                    errors.append(f"{kind}:{cid}:{row['level']}: unknown requirement {req['type']}:{req['id']}")
                elif req["level"] > target["maxLevel"]:
                    errors.append(f"{kind}:{cid}:{row['level']}: requirement {req['id']} Lv{req['level']} > max {target['maxLevel']}")

    # 2. 순환 검사 — 노드 (kind, id, level), 간선: 이전 레벨 + requirements
    indeg: dict[tuple, int] = defaultdict(int)
    dependents: dict[tuple, list] = defaultdict(list)
    nodes = set()
    for (kind, cid), entry in catalog.items():
        for row in entry["levels"]:
            node = (kind, cid, row["level"])
            nodes.add(node)
            deps = [(kind, cid, row["level"] - 1)] if row["level"] > 1 else []
            deps += [(req["type"], req["id"], req["level"]) for req in row["requirements"]
                     if (req["type"], req["id"]) in catalog]
            for dep in deps:
                dependents[dep].append(node)
                indeg[node] += 1
    queue = deque(n for n in nodes if indeg[n] == 0)
    seen = 0
    while queue:
        node = queue.popleft()
        seen += 1
        for nxt in dependents[node]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
    if seen != len(nodes):
        errors.append(f"cycle detected: {len(nodes) - seen} nodes in cycles")

    # 5. 아이콘
    for kind, sub, entries in [("building", "buildings", buildings), ("research", "research", research)]:
        for entry in entries:
            if not (ICONS / sub / f"{entry['id']}.png").exists():
                errors.append(f"icon missing: {sub}/{entry['id']}.png")

    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    print(f"{'FAIL' if errors else 'OK'}: {len(nodes)} nodes, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
