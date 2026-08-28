"""수집된 데이터의 정합성 검증. 위반 시 exit 1 (CI 게이트).

검사 항목:
1. 모든 requirement가 존재하는 id/레벨을 가리킨다
2. (id, level) 그래프에 순환이 없다 (Kahn)
3. 레벨은 1..maxLevel 연속
4. 시간/비용/파워 음수 없음
5. 모든 id에 아이콘 파일 존재

추가로 위키 원문이 "unknown"이라 0으로 파싱된 알려진 placeholder 값들은
비치명적 WARNING으로만 출력한다 (exit 코드에 영향 없음).
"""
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "src" / "data"
ICONS = ROOT / "web" / "public" / "icons"

# 위키에 "unknown"으로 표기되어 0으로 파싱된 것으로 알려진 (kind, id, level, field) 목록.
# 이 조합에서만 0 값을 오류가 아닌 경고로 취급한다.
KNOWN_ZERO_PLACEHOLDERS = {
    ("research", "academy", 25, "timeSec"),
    ("research", "scout_camp", 25, "timeSec"),
    ("research", "scout_camp", 25, "cost"),
    ("building", "blacksmith", 1, "power"),
    ("research", "stone_saw", 10, "timeSec"),
    ("research", "machinery", 10, "timeSec"),
    ("research", "shaft_mining", 10, "timeSec"),
    ("research", "ballistics", 10, "timeSec"),
    ("research", "pavise", 10, "timeSec"),
    ("research", "plate_armor", 10, "timeSec"),
    ("research", "heavy_frame", 10, "timeSec"),
}


def main() -> int:
    buildings = json.loads((DATA / "buildings.json").read_text(encoding="utf-8"))
    research = json.loads((DATA / "research.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []

    catalog = {("building", b["id"]): b for b in buildings}
    catalog.update({("research", r["id"]): r for r in research})

    # 1, 3, 4
    for (kind, cid), entry in catalog.items():
        levels = [row["level"] for row in entry["levels"]]
        if levels != list(range(1, entry["maxLevel"] + 1)):
            errors.append(f"{kind}:{cid}: non-contiguous levels {levels}")
        for row in entry["levels"]:
            zero_time = ("time" if (kind, cid, row["level"], "timeSec") in KNOWN_ZERO_PLACEHOLDERS else None)
            zero_power = ("power" if (kind, cid, row["level"], "power") in KNOWN_ZERO_PLACEHOLDERS else None)
            zero_cost = (kind, cid, row["level"], "cost") in KNOWN_ZERO_PLACEHOLDERS

            if row["timeSec"] < 0:
                errors.append(f"{kind}:{cid}:{row['level']}: negative timeSec")
            elif row["timeSec"] == 0 and (kind, cid, row["level"], "timeSec") in KNOWN_ZERO_PLACEHOLDERS:
                warnings.append(f"{kind}:{cid}:{row['level']}: timeSec=0 (wiki 'unknown' placeholder)")

            if row["power"] < 0:
                errors.append(f"{kind}:{cid}:{row['level']}: negative power")
            elif row["power"] == 0 and (kind, cid, row["level"], "power") in KNOWN_ZERO_PLACEHOLDERS:
                warnings.append(f"{kind}:{cid}:{row['level']}: power=0 (wiki 'unknown' placeholder)")

            if any(v < 0 for v in row["cost"].values()):
                errors.append(f"{kind}:{cid}:{row['level']}: negative cost")
            elif zero_cost and all(v == 0 for v in row["cost"].values()):
                warnings.append(f"{kind}:{cid}:{row['level']}: cost=0 (wiki 'unknown' placeholder)")

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
