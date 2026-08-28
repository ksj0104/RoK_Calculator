# RoK 최적화 계산기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rise of Kingdoms 건물·연구 목표(예: 시청 25) 도달 시간을 최소화하는 순서와 가속 아이템 배분을 계산하는 서버리스 React SPA.

**Architecture:** Python 스크립트가 riseofkingdoms.fandom.com MediaWiki API에서 건물/연구 데이터와 아이콘을 수집해 정적 JSON으로 저장한다. 순수 TypeScript 엔진이 (id, level) 노드 DAG를 만들어 역방향 폐포 → 크리티컬 패스 스케줄링 → 가속 그리디 배분을 수행한다. React UI는 내 도시 / 목표 / 결과 3개 탭.

**Tech Stack:** Python 3 (requests, beautifulsoup4, pytest) / React 18 + TypeScript + Vite + Vitest / 순수 CSS.

**Spec:** `docs/superpowers/specs/2026-08-28-rok-calculator-design.md`

## Global Constraints

- 데이터 출처: `https://riseofkingdoms.fandom.com/api.php` (MediaWiki API). 요청 간 0.5초 딜레이, User-Agent `RoK-Calculator-Scraper/1.0 (personal fan project)`.
- 모든 응답은 `scripts/.cache/`에 캐시하고 재실행 시 캐시 우선 사용 (위키에 부담 최소화).
- id 규칙: 영문 소문자 + 언더스코어 (`City Hall` → `city_hall`, `Cutting & Polishing` → `cutting_and_polishing`).
- 노드 키 규칙: `` `${kind}:${id}:${level}` `` (예: `building:city_hall:25`).
- 건물은 타입당 1인스턴스로 모델링한다 (요구조건은 "해당 타입 최고 레벨 인스턴스" 기준 — 스펙 참조).
- 장식(Decorative) 건물은 범위 외. 진행형 건물 25종만.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 시간 값은 전부 초(sec) 단위 정수. 자원 값은 정수.
- UI 문자열은 반드시 i18n 딕셔너리를 통해서만 (하드코딩 금지).

## 파일 구조 (최종)

```
scripts/
  requirements.txt
  rok_wiki/__init__.py
  rok_wiki/api.py              # API fetch + 캐시
  rok_wiki/textutil.py         # 숫자/시간/id 파싱 유틸
  rok_wiki/parse_buildings.py  # 건물 HTML 테이블 파서
  rok_wiki/parse_tech.py       # 연구 목록/테이블 파서
  rok_wiki/icons.py            # 아이콘 URL 조회 + 다운로드
  scrape_wiki.py               # CLI 오케스트레이터 (data JSON + 아이콘 생성)
  validate_data.py             # 데이터 정합성 검증 (CI 게이트)
  tests/fixtures/              # 저장된 위키 HTML 픽스처
  tests/test_textutil.py
  tests/test_parse_buildings.py
  tests/test_parse_tech.py
web/
  src/data/buildings.json      # 생성됨
  src/data/research.json       # 생성됨
  src/data/names.en.json       # 생성됨
  src/data/names.ko.json       # 수동 관리
  src/data/overrides.json      # 위키 오류 수동 보정
  src/engine/types.ts
  src/engine/graph.ts          # 카탈로그 인덱스 + 노드 생성
  src/engine/closure.ts        # 목표 → 필요 노드 집합
  src/engine/critical.ts       # 크리티컬 패스 가중치
  src/engine/scheduler.ts      # 이산 사건 시뮬레이션
  src/engine/speedups.ts       # 가속 배분
  src/engine/plan.ts           # 오케스트레이터 (computePlan)
  src/engine/__tests__/*.test.ts
  src/state/userState.ts       # 상태 타입 + reducer + localStorage
  src/i18n/index.tsx           # LangProvider + t()
  src/i18n/ui.ko.ts, ui.en.ts
  src/ui/App.tsx, CityTab.tsx, ResearchTree.tsx, SpeedupPanel.tsx,
        GoalsTab.tsx, ResultTab.tsx
  src/styles.css
  public/icons/buildings/<id>.png
  public/icons/research/<id>.png
```

---

### Task 1: Python 스크레이퍼 기반 — API 클라이언트 + 텍스트 유틸

**Files:**
- Create: `scripts/requirements.txt`, `scripts/rok_wiki/__init__.py`, `scripts/rok_wiki/api.py`, `scripts/rok_wiki/textutil.py`
- Test: `scripts/tests/test_textutil.py`

**Interfaces:**
- Produces: `api.fetch_parse(page: str) -> dict` (action=parse 결과 JSON의 `parse` 항목, 디스크 캐시), `api.fetch_html(page: str) -> str` (렌더링된 HTML), `textutil.parse_amount(s: str) -> int`, `textutil.parse_duration(s: str) -> int`, `textutil.slugify(name: str) -> str`

- [ ] **Step 1: 의존성 파일과 패키지 뼈대 작성**

`scripts/requirements.txt`:
```
requests>=2.31
beautifulsoup4>=4.12
pytest>=8.0
```

`scripts/rok_wiki/__init__.py`: 빈 파일.

설치: `cd scripts && ..\.venv\Scripts\python -m pip install -r requirements.txt`

- [ ] **Step 2: textutil 실패 테스트 작성**

`scripts/tests/test_textutil.py`:
```python
from rok_wiki.textutil import parse_amount, parse_duration, slugify

def test_parse_amount_plain():
    assert parse_amount("1,847") == 1847

def test_parse_amount_k_m_suffix():
    assert parse_amount("3.5K") == 3500
    assert parse_amount("184.3K") == 184300
    assert parse_amount("1.2M") == 1200000

def test_parse_amount_none_and_empty():
    assert parse_amount("None") == 0
    assert parse_amount("") == 0

def test_parse_duration_units():
    assert parse_duration("2s") == 2
    assert parse_duration("5m") == 300
    assert parse_duration("1h 30m") == 5400
    assert parse_duration("22h") == 79200
    assert parse_duration("3d 12h") == 302400
    assert parse_duration("None") == 0

def test_slugify():
    assert slugify("City Hall") == "city_hall"
    assert slugify("Cutting & Polishing") == "cutting_and_polishing"
    assert slugify("Builder's Hut") == "builders_hut"
    assert slugify("Chu-Ko-Nu") == "chu_ko_nu"
```

- [ ] **Step 3: 테스트 실행, 실패 확인**

Run: `cd scripts && ..\.venv\Scripts\python -m pytest tests/test_textutil.py -v`
Expected: FAIL (`ModuleNotFoundError: rok_wiki.textutil`)

- [ ] **Step 4: textutil 구현**

`scripts/rok_wiki/textutil.py`:
```python
import re

_SUFFIX = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
_UNIT_SEC = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_amount(s: str) -> int:
    s = (s or "").strip().replace(",", "")
    if not s or s.lower() == "none":
        return 0
    m = re.fullmatch(r"([\d.]+)\s*([KMB])?", s)
    if not m:
        raise ValueError(f"cannot parse amount: {s!r}")
    value = float(m.group(1)) * _SUFFIX.get(m.group(2) or "", 1)
    return round(value)


def parse_duration(s: str) -> int:
    s = (s or "").strip()
    if not s or s.lower() == "none":
        return 0
    total = 0
    for num, unit in re.findall(r"(\d+)\s*([smhd])", s):
        total += int(num) * _UNIT_SEC[unit]
    if total == 0 and not re.search(r"[smhd]", s):
        raise ValueError(f"cannot parse duration: {s!r}")
    return total


def slugify(name: str) -> str:
    s = name.strip().lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd scripts && ..\.venv\Scripts\python -m pytest tests/test_textutil.py -v`
Expected: PASS (7건)

- [ ] **Step 6: API 클라이언트 구현 (테스트는 통합 수준이라 생략, 캐시 동작만 수동 확인)**

`scripts/rok_wiki/api.py`:
```python
import hashlib
import json
import time
from pathlib import Path

import requests

API = "https://riseofkingdoms.fandom.com/api.php"
CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"
HEADERS = {"User-Agent": "RoK-Calculator-Scraper/1.0 (personal fan project)"}
_DELAY_SEC = 0.5
_last_request = 0.0


def _get(params: dict) -> dict:
    global _last_request
    CACHE_DIR.mkdir(exist_ok=True)
    key = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    wait = _DELAY_SEC - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    resp = requests.get(API, params={**params, "format": "json", "formatversion": "2"},
                        headers=HEADERS, timeout=30)
    _last_request = time.monotonic()
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"wiki API error for {params}: {data['error']['info']}")
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def fetch_parse(page: str) -> dict:
    """action=parse 결과의 parse 딕셔너리 (wikitext 포함)."""
    return _get({"action": "parse", "page": page, "prop": "wikitext"})["parse"]


def fetch_html(page: str) -> str:
    """렌더링된 페이지 HTML."""
    return _get({"action": "parse", "page": page, "prop": "text"})["parse"]["text"]


def fetch_image_urls(prefix: str) -> dict[str, str]:
    """파일명 prefix로 이미지 검색, {파일명: URL} 반환."""
    data = _get({"action": "query", "list": "allimages", "aiprefix": prefix, "ailimit": "50"})
    return {img["name"]: img["url"] for img in data["query"]["allimages"]}
```

- [ ] **Step 7: 캐시 동작 수동 확인**

Run: `cd scripts && ..\.venv\Scripts\python -c "from rok_wiki.api import fetch_html; h = fetch_html('Buildings/City_Hall/Requirements'); print(len(h)); print('article-table' in h)"`
Expected: HTML 길이 출력 + `True`. 두 번째 실행은 즉시 반환(캐시 적중).

- [ ] **Step 8: Commit**

```bash
git add scripts/
git commit -m "feat: 위키 API 클라이언트와 텍스트 파싱 유틸"
```

---

### Task 2: 건물 테이블 파서

**Files:**
- Create: `scripts/rok_wiki/parse_buildings.py`, `scripts/tests/fixtures/city_hall_requirements.html`
- Test: `scripts/tests/test_parse_buildings.py`

**Interfaces:**
- Consumes: `textutil.parse_amount/parse_duration/slugify`, `api.fetch_html`
- Produces: `parse_building_table(html: str, building_id: str) -> list[dict]` — 각 원소는
  `{"level": int, "requirements": [{"type": "building", "id": str, "level": int}], "cost": {"food": int, "wood": int, "stone": int, "gold": int}, "timeSec": int, "power": int}`

- [ ] **Step 1: 픽스처 저장**

Run:
```bash
cd scripts && ..\.venv\Scripts\python -c "from rok_wiki.api import fetch_html; from pathlib import Path; Path('tests/fixtures').mkdir(parents=True, exist_ok=True); Path('tests/fixtures/city_hall_requirements.html').write_text(fetch_html('Buildings/City_Hall/Requirements'), encoding='utf-8')"
```

- [ ] **Step 2: 실패 테스트 작성**

`scripts/tests/test_parse_buildings.py`:
```python
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
```

- [ ] **Step 3: 테스트 실행, 실패 확인**

Run: `cd scripts && ..\.venv\Scripts\python -m pytest tests/test_parse_buildings.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 4: 파서 구현**

`scripts/rok_wiki/parse_buildings.py`:
```python
"""건물 Requirements 페이지의 렌더링 HTML에서 레벨 테이블을 추출한다.

테이블 구조: class="article-table building-table". 헤더 컬럼은 건물마다 다르지만
Level / Requirements / Cost / Time / Power 는 공통이고 그 외(Unlocks, Troop Capacity 등)는 무시한다.
시대 구분 행(th colspan)은 건너뛴다.
"""
import re

from bs4 import BeautifulSoup

from .textutil import parse_amount, parse_duration, slugify

RESOURCES = ("food", "wood", "stone", "gold")


def _requirements_from_cell(cell) -> list[dict]:
    reqs = []
    # 렌더링된 셀은 "<a>Wall</a> Lv.2<br/><a>Hospital</a> Lv.4" 형태.
    # <br> 기준으로 나눠 각 조각에서 링크 텍스트와 "Lv.N"/"Level N"을 짝짓는다.
    for part in re.split(r"<br\s*/?>", cell.decode_contents()):
        frag = BeautifulSoup(part, "html.parser")
        link = frag.find("a")
        m = re.search(r"(?:Lv\.?|Level)\s*(\d+)", frag.get_text())
        if link and m:
            reqs.append({"type": "building", "id": slugify(link.get_text()), "level": int(m.group(1))})
    return reqs


def _cost_from_cell(cell) -> dict:
    # BuildingResources 템플릿은 자원별 아이콘 <img alt="Food" ...> 뒤에 수치 텍스트가 온다.
    cost = {r: 0 for r in RESOURCES}
    for img in cell.find_all("img"):
        alt = (img.get("alt") or img.get("data-image-name") or "").lower()
        resource = next((r for r in RESOURCES if r in alt), None)
        if resource is None:
            continue
        tail = img.find_parent().get_text(" ", strip=True) if img.find_parent() else ""
        m = re.search(r"([\d,.]+\s*[KMB]?)", tail)
        if m:
            cost[resource] = parse_amount(m.group(1))
    return cost


def parse_building_table(html: str, building_id: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="building-table") or soup.find("table", class_="article-table")
    if table is None:
        raise ValueError(f"{building_id}: no building table found")

    header_cells = [th.get_text(" ", strip=True).lower() for th in table.find("tr").find_all("th")]

    def col(name: str) -> int | None:
        for i, h in enumerate(header_cells):
            if name in h:
                return i
        return None

    idx = {name: col(name) for name in ("level", "requirement", "cost", "time", "power")}
    for required in ("level", "cost", "time", "power"):
        if idx[required] is None:
            raise ValueError(f"{building_id}: missing column {required!r} in {header_cells}")

    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:            # 헤더 행 / 시대 구분 행(th만 있음)
            continue
        if len(cells) < len([i for i in idx.values() if i is not None]):
            continue             # 비정상 행은 건너뛰고 validate에서 잡는다
        level_text = cells[idx["level"]].get_text(strip=True)
        if not level_text.isdigit():
            continue
        rows.append({
            "level": int(level_text),
            "requirements": _requirements_from_cell(cells[idx["requirement"]]) if idx["requirement"] is not None else [],
            "cost": _cost_from_cell(cells[idx["cost"]]),
            "timeSec": parse_duration(cells[idx["time"]].get_text(" ", strip=True)),
            "power": parse_amount(cells[idx["power"]].get_text(strip=True)),
        })
    rows.sort(key=lambda r: r["level"])
    return rows
```

- [ ] **Step 5: 테스트 통과할 때까지 실측 보정**

Run: `cd scripts && ..\.venv\Scripts\python -m pytest tests/test_parse_buildings.py -v`
Expected: PASS. 실패하면 픽스처 HTML을 열어 실제 렌더링 구조(자원 아이콘 alt 텍스트, Lv 표기)를 확인하고 `_cost_from_cell` / `_requirements_from_cell`의 셀렉터만 조정한다. 테스트의 기대값(6,500 / 300초 / wall Lv2 등)은 위키 실측값이므로 바꾸지 않는다.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat: 건물 레벨 테이블 파서"
```

---

### Task 3: 연구 파서 (목록 + 개별 테이블)

**Files:**
- Create: `scripts/rok_wiki/parse_tech.py`, `scripts/tests/fixtures/technology_list.txt`, `scripts/tests/fixtures/masonry.html`
- Test: `scripts/tests/test_parse_tech.py`

**Interfaces:**
- Consumes: `api.fetch_parse/fetch_html`, `textutil.*`
- Produces:
  - `parse_tech_list(wikitext: str) -> list[dict]` — `{"name": "Masonry", "tree": "economic" | "military", "tier": int}`
  - `parse_tech_table(html: str, tech_id: str) -> list[dict]` — 건물 파서와 동일한 레벨 dict 구조 (requirements의 type은 `research` 또는 `building`(Academy))

- [ ] **Step 1: 픽스처 저장**

```bash
cd scripts && ..\.venv\Scripts\python -c "
from rok_wiki.api import fetch_parse, fetch_html
from pathlib import Path
Path('tests/fixtures/technology_list.txt').write_text(fetch_parse('Technology')['wikitext'], encoding='utf-8')
Path('tests/fixtures/masonry.html').write_text(fetch_html('Technology/Masonry'), encoding='utf-8')
"
```

- [ ] **Step 2: 실패 테스트 작성**

`scripts/tests/test_parse_tech.py`:
```python
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
```

- [ ] **Step 3: 테스트 실행, 실패 확인**

Run: `cd scripts && ..\.venv\Scripts\python -m pytest tests/test_parse_tech.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 4: 파서 구현**

`scripts/rok_wiki/parse_tech.py`:
```python
"""Technology 페이지(위키텍스트)에서 연구 목록을, 개별 연구 페이지(HTML)에서 레벨 테이블을 추출."""
import re

from bs4 import BeautifulSoup

from .parse_buildings import _cost_from_cell  # 동일한 BuildingResources 렌더링
from .textutil import parse_amount, parse_duration, slugify


def parse_tech_list(wikitext: str) -> list[dict]:
    techs = []
    # Economic / Military ItemBlock 두 덩어리. header= 줄로 분할해 현재 트리를 추적한다.
    tree = None
    tier = 0
    for line in wikitext.splitlines():
        h = re.search(r"header=.*?(Economic|Military) Technology", line)
        if h:
            tree = h.group(1).lower()
            continue
        t = re.search(r"<h3>\s*Tier\s*(\d+)\s*</h3>", line)
        if t:
            tier = int(t.group(1))
            continue
        for name in re.findall(r"\{\{BlockGalleryItemTech\|([^}|]+)", line):
            if tree:
                techs.append({"name": name.strip(), "tree": tree, "tier": tier})
    return techs


def _requirements_from_cell(cell) -> list[dict]:
    reqs = []
    for part in re.split(r"<br\s*/?>", cell.decode_contents()):
        frag = BeautifulSoup(part, "html.parser")
        link = frag.find("a")
        m = re.search(r"(?:Lv\.?|Level)\s*(\d+)", frag.get_text())
        if not (link and m):
            continue
        name = slugify(link.get_text())
        href = link.get("href") or ""
        kind = "building" if "/Buildings/" in href else "research"
        reqs.append({"type": kind, "id": name, "level": int(m.group(1))})
    return reqs


def parse_tech_table(html: str, tech_id: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="tech-table") or soup.find("table", class_="article-table")
    if table is None:
        raise ValueError(f"{tech_id}: no tech table found")

    header_cells = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]

    def col(name: str) -> int | None:
        for i, h in enumerate(header_cells):
            if name in h:
                return i
        return None

    idx = {name: col(name) for name in ("level", "requirement", "cost", "time", "power")}
    for required in ("level", "cost", "time", "power"):
        if idx[required] is None:
            raise ValueError(f"{tech_id}: missing column {required!r} in {header_cells}")

    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        level_text = cells[idx["level"]].get_text(strip=True)
        if not level_text.isdigit():
            continue
        rows.append({
            "level": int(level_text),
            "requirements": _requirements_from_cell(cells[idx["requirement"]]) if idx["requirement"] is not None else [],
            "cost": _cost_from_cell(cells[idx["cost"]]),
            "timeSec": parse_duration(cells[idx["time"]].get_text(" ", strip=True)),
            "power": parse_amount(cells[idx["power"]].get_text(strip=True)),
        })
    rows.sort(key=lambda r: r["level"])
    return rows
```

- [ ] **Step 5: 테스트 통과 확인 (실패 시 픽스처 실측으로 셀렉터 보정, 기대값 유지)**

Run: `cd scripts && ..\.venv\Scripts\python -m pytest tests/ -v`
Expected: PASS (전체)

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat: 연구 목록/테이블 파서"
```

---

### Task 4: 전체 수집 오케스트레이터 + 아이콘 다운로드

**Files:**
- Create: `scripts/rok_wiki/icons.py`, `scripts/scrape_wiki.py`, `web/src/data/overrides.json`
- 생성물: `web/src/data/buildings.json`, `web/src/data/research.json`, `web/src/data/names.en.json`, `web/public/icons/buildings/*.png`, `web/public/icons/research/*.png`

**Interfaces:**
- Consumes: Task 1–3의 모든 함수
- Produces: 최종 데이터 JSON 스키마 —
  - `buildings.json`: `[{"id", "category": "economic"|"military"|"other", "maxLevel", "levels": [...]}]`
  - `research.json`: `[{"id", "tree", "tier", "maxLevel", "levels": [...]}]`
  - `names.en.json`: `{"building_or_research_id": "Display Name"}`

- [ ] **Step 1: 건물 마스터 목록 하드코딩 + 오케스트레이터 작성**

Buildings 페이지 조사 결과를 그대로 옮긴다 (진행형 25종). `scripts/scrape_wiki.py`:
```python
"""위키에서 건물/연구 데이터와 아이콘을 수집해 web/src/data + web/public/icons 에 저장한다.

사용법: ..\.venv\Scripts\python scrape_wiki.py [--skip-icons]
캐시(.cache/)가 있으면 네트워크 요청 없이 재생성된다.
"""
import argparse
import json
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
            levels = parse_building_table(fetch_html(page), bid)
        except Exception as e:  # noqa: BLE001 - 수집 도구: 수집 가능한 것부터 저장하고 경고
            warnings.append(f"building {bid}: {e}")
            continue
        buildings.append({"id": bid, "category": category,
                          "maxLevel": max(r["level"] for r in levels), "levels": levels})

    tech_list = parse_tech_list(fetch_parse("Technology")["wikitext"])
    research = []
    for tech in tech_list:
        tid = slugify(tech["name"])
        names_en[tid] = tech["name"]
        page = f"Technology/{tech['name'].replace(' ', '_')}"
        try:
            levels = parse_tech_table(fetch_html(page), tid)
        except Exception as e:  # noqa: BLE001
            warnings.append(f"research {tid}: {e}")
            continue
        research.append({"id": tid, "tree": tech["tree"], "tier": tech["tier"],
                         "maxLevel": max(r["level"] for r in levels), "levels": levels})

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
```

`web/src/data/overrides.json` 초기값:
```json
{ "buildings": {}, "research": {} }
```

- [ ] **Step 2: 아이콘 다운로더 작성**

`scripts/rok_wiki/icons.py`:
```python
"""위키 이미지 파일에서 건물/연구 아이콘을 내려받는다.

파일명 규칙(조사 결과): 건물 = "Building_<Name>_1_5.png" 또는 "_6_4" 등 변형이 있어
prefix 검색 후 첫 매치를 쓴다. 연구 = "Technology_<Name>.png" (정확 일치 우선).
"""
import time
from pathlib import Path

import requests

from .api import HEADERS, fetch_image_urls


def _download(url: str, dest: Path) -> None:
    if dest.exists():
        return
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    time.sleep(0.5)


def _pick(candidates: dict[str, str], exact: str | None = None) -> str | None:
    if exact and exact in candidates:
        return candidates[exact]
    return next(iter(sorted(candidates.items())), (None, None))[1]


def download_all_icons(building_ids: list[str], research_ids: list[str],
                       names_en: dict[str, str], out_dir: Path) -> list[str]:
    warnings = []
    (out_dir / "buildings").mkdir(parents=True, exist_ok=True)
    (out_dir / "research").mkdir(parents=True, exist_ok=True)

    for bid in building_ids:
        wiki_name = names_en[bid].replace(" ", "_")
        url = _pick(fetch_image_urls(f"Building_{wiki_name}"))
        if url is None:
            warnings.append(f"icon missing: building {bid}")
            continue
        _download(url, out_dir / "buildings" / f"{bid}.png")

    for rid in research_ids:
        wiki_name = names_en[rid].replace(" ", "_")
        url = _pick(fetch_image_urls(f"Technology_{wiki_name}"), exact=f"Technology_{wiki_name}.png")
        if url is None:
            warnings.append(f"icon missing: research {rid}")
            continue
        _download(url, out_dir / "research" / f"{rid}.png")
    return warnings
```

- [ ] **Step 3: 전체 수집 실행 (네트워크, 수 분 소요 — 백그라운드 실행)**

Run: `cd scripts && ..\.venv\Scripts\python scrape_wiki.py`
Expected: `buildings: 25±, research: 90±` 출력. WARNING 목록을 기록해 둔다 (다음 태스크의 검증/보정 대상). 아이콘 파일이 `web/public/icons/`에 생성됨.

- [ ] **Step 4: 산출물 스팟 체크**

Run: `cd scripts && ..\.venv\Scripts\python -c "
import json
b = json.load(open('../web/src/data/buildings.json', encoding='utf-8'))
r = json.load(open('../web/src/data/research.json', encoding='utf-8'))
ch = next(x for x in b if x['id'] == 'city_hall')
print('city_hall maxLevel:', ch['maxLevel'])
print('lv25 time(h):', ch['levels'][-1]['timeSec'] / 3600)
print('research count:', len(r))
"`
Expected: maxLevel 25, lv25 시간이 수백 시간대(원시값), 연구 ~90개.

- [ ] **Step 5: Commit (데이터/아이콘 포함)**

```bash
git add scripts/ web/src/data/ web/public/icons/
git commit -m "feat: 위키 전체 수집 — 건물/연구 데이터와 아이콘"
```

---

### Task 5: 데이터 검증 스크립트

**Files:**
- Create: `scripts/validate_data.py`

**Interfaces:**
- Consumes: `web/src/data/*.json`, `web/public/icons/`
- Produces: 실행 파일 — 정상이면 exit 0, 위반 발견 시 위반 목록 출력 후 exit 1

- [ ] **Step 1: 검증 스크립트 작성**

`scripts/validate_data.py`:
```python
"""수집된 데이터의 정합성 검증. 위반 시 exit 1 (CI 게이트).

검사 항목:
1. 모든 requirement가 존재하는 id/레벨을 가리킨다
2. (id, level) 그래프에 순환이 없다 (Kahn)
3. 레벨은 1..maxLevel 연속
4. 시간/비용/파워 음수 없음
5. 모든 id에 아이콘 파일 존재
"""
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "src" / "data"
ICONS = ROOT / "web" / "public" / "icons"


def main() -> int:
    buildings = json.loads((DATA / "buildings.json").read_text(encoding="utf-8"))
    research = json.loads((DATA / "research.json").read_text(encoding="utf-8"))
    errors: list[str] = []

    catalog = {("building", b["id"]): b for b in buildings}
    catalog.update({("research", r["id"]): r for r in research})

    # 1, 3, 4
    for (kind, cid), entry in catalog.items():
        levels = [row["level"] for row in entry["levels"]]
        if levels != list(range(1, entry["maxLevel"] + 1)):
            errors.append(f"{kind}:{cid}: non-contiguous levels {levels}")
        for row in entry["levels"]:
            if row["timeSec"] < 0 or row["power"] < 0 or any(v < 0 for v in row["cost"].values()):
                errors.append(f"{kind}:{cid}:{row['level']}: negative value")
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

    for e in errors:
        print(f"ERROR: {e}")
    print(f"{'FAIL' if errors else 'OK'}: {len(nodes)} nodes, {len(errors)} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: 실행 — 실제 데이터의 오류 목록 확보**

Run: `cd scripts && ..\.venv\Scripts\python validate_data.py`
Expected: 첫 실행은 오류가 나올 수 있다 (위키 데이터 불완전). 오류를 하나씩 보고:
- 파서 버그면 파서 수정 후 `scrape_wiki.py` 재실행 (캐시라 빠름)
- 위키 원본 오류면 `web/src/data/overrides.json`에 보정값 추가 후 재실행
- 아이콘 누락이면 `icons.py`의 prefix 검색 결과를 확인해 파일명 규칙 보완
OK가 나올 때까지 반복한다.

- [ ] **Step 3: Commit**

```bash
git add scripts/ web/src/data/
git commit -m "feat: 데이터 정합성 검증 스크립트 + 데이터 보정"
```

---

### Task 6: 한국어 이름 매핑

**Files:**
- Create: `web/src/data/names.ko.json`

**Interfaces:**
- Produces: `names.ko.json` — `{"id": "한국어 이름"}`. 누락 id는 UI에서 영문으로 폴백.

- [ ] **Step 1: 건물 25종 + 주요 경제/군사 연구의 한국어 이름 작성**

게임 한국어판 명칭 기준으로 작성한다 (건물 예: 시청, 성벽, 감시탑, 농장, 벌목장, 채석장, 금광, 학사원, 창고, 연맹 센터, 건축가 오두막, 상점, 교역소, 지혜의 전당, 역참, 선술집, 정찰 기지, 병영, 궁술 훈련장, 마구간, 공성 공방, 병원, 기념비, 성, 대장간, 게시판). 연구는 `names.en.json`의 전체 id 목록을 순회하며 아는 것부터 채우고, 불확실한 항목은 넣지 않는다(영문 폴백). 사용자가 이후 직접 교정할 수 있는 단순 JSON 유지.

Run (커버리지 확인): `cd scripts && ..\.venv\Scripts\python -c "
import json
en = json.load(open('../web/src/data/names.en.json', encoding='utf-8'))
ko = json.load(open('../web/src/data/names.ko.json', encoding='utf-8'))
missing = [k for k in en if k not in ko]
print(f'ko coverage: {len(ko)}/{len(en)}, missing: {missing[:10]}')
"`
Expected: 건물 25종은 100% 커버, 전체 커버리지 출력.

- [ ] **Step 2: Commit**

```bash
git add web/src/data/names.ko.json
git commit -m "feat: 한국어 이름 매핑"
```

---

### Task 7: Vite 프로젝트 스캐폴드 + 엔진 타입

**Files:**
- Create: `web/` Vite 프로젝트 (package.json, tsconfig, vite.config.ts 등), `web/src/engine/types.ts`, `.gitignore`

**Interfaces:**
- Produces (이후 모든 태스크가 사용):

```ts
// web/src/engine/types.ts 전체 — 아래 Step 2 코드가 정본
export type Resource = 'food' | 'wood' | 'stone' | 'gold';
export type Cost = Record<Resource, number>;
export type NodeKind = 'building' | 'research';
export interface Requirement { type: NodeKind; id: string; level: number }
export interface LevelData { level: number; requirements: Requirement[]; cost: Cost; timeSec: number; power: number }
export interface CatalogEntry { id: string; kind: NodeKind; category: string; maxLevel: number; levels: LevelData[] }
export interface Goal { type: NodeKind; id: string; level: number }
export type NodeId = string;
export interface TaskNode { key: NodeId; kind: NodeKind; id: string; level: number; timeSec: number; cost: Cost; power: number; deps: NodeId[] }
export type SpeedupType = 'universal' | 'building' | 'research';
export type SpeedupInventory = Record<SpeedupType, Record<string, number>>;
export interface UserState { buildings: Record<string, number>; research: Record<string, number>; speedups: SpeedupInventory; buffs: { buildingSpeedPct: number; researchSpeedPct: number }; secondBuilder: boolean }
```

- [ ] **Step 1: Vite 스캐폴드**

```bash
npm create vite@latest web -- --template react-ts
cd web && npm install && npm install -D vitest
```

`web/package.json`의 scripts에 `"test": "vitest run"` 추가.
루트 `.gitignore` 작성: `node_modules/`, `dist/`, `scripts/.cache/`, `.venv/`, `.idea/`, `.omc/`.

- [ ] **Step 2: types.ts 작성**

`web/src/engine/types.ts`:
```ts
export type Resource = 'food' | 'wood' | 'stone' | 'gold';
export type Cost = Record<Resource, number>;
export type NodeKind = 'building' | 'research';

export interface Requirement { type: NodeKind; id: string; level: number }

export interface LevelData {
  level: number;
  requirements: Requirement[];
  cost: Cost;
  timeSec: number;
  power: number;
}

export interface CatalogEntry {
  id: string;
  kind: NodeKind;
  category: string;      // building: economic|military|other, research: economic|military(tree)
  maxLevel: number;
  levels: LevelData[];
}

export interface Goal { type: NodeKind; id: string; level: number }

export type NodeId = string; // `${kind}:${id}:${level}`
export const nodeId = (kind: NodeKind, id: string, level: number): NodeId =>
  `${kind}:${id}:${level}`;

export interface TaskNode {
  key: NodeId;
  kind: NodeKind;
  id: string;
  level: number;
  timeSec: number;       // 원시(버프 미적용) 시간
  cost: Cost;
  power: number;
  deps: NodeId[];
}

export type SpeedupType = 'universal' | 'building' | 'research';
/** 가속 종류 → { 지속시간 id → 개수 }. 지속시간 id는 SPEEDUP_DURATIONS의 키. */
export type SpeedupInventory = Record<SpeedupType, Record<string, number>>;

export const SPEEDUP_DURATIONS: Record<string, number> = {
  '1m': 60, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '60m': 3600,
  '3h': 10800, '8h': 28800, '15h': 54000, '24h': 86400,
  '3d': 259200, '7d': 604800, '30d': 2592000,
};

export interface UserState {
  buildings: Record<string, number>;   // id → 현재 레벨 (없으면 0)
  research: Record<string, number>;
  speedups: SpeedupInventory;
  buffs: { buildingSpeedPct: number; researchSpeedPct: number };
  secondBuilder: boolean;
}

export const emptySpeedups = (): SpeedupInventory => ({
  universal: {}, building: {}, research: {},
});

export const defaultUserState = (): UserState => ({
  buildings: { city_hall: 1 },
  research: {},
  speedups: emptySpeedups(),
  buffs: { buildingSpeedPct: 0, researchSpeedPct: 0 },
  secondBuilder: false,
});
```

- [ ] **Step 3: 빌드/테스트 러너 동작 확인**

Run: `cd web && npm run build && npm test`
Expected: 빌드 성공, vitest "no test files" (아직 정상).

- [ ] **Step 4: Commit**

```bash
git add web/ .gitignore
git commit -m "feat: Vite 스캐폴드와 엔진 타입 정의"
```

---

### Task 8: 엔진 — 카탈로그 인덱스 + 목표 폐포 (closure)

**Files:**
- Create: `web/src/engine/graph.ts`, `web/src/engine/closure.ts`, `web/src/engine/__tests__/fixtures.ts`
- Test: `web/src/engine/__tests__/closure.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces:
  - `graph.ts`: `buildIndex(entries: CatalogEntry[]): CatalogIndex`, `interface CatalogIndex { get(kind: NodeKind, id: string): CatalogEntry | undefined; makeNode(kind: NodeKind, id: string, level: number): TaskNode }`
  - `closure.ts`: `requiredNodes(index: CatalogIndex, goals: Goal[], state: UserState): Map<NodeId, TaskNode>` — 이미 달성분 제외, 선행 전이 폐포 포함

- [ ] **Step 1: 테스트용 소형 카탈로그 픽스처 작성**

`web/src/engine/__tests__/fixtures.ts`:
```ts
import type { CatalogEntry, UserState } from '../types';
import { emptySpeedups } from '../types';

const cost0 = { food: 0, wood: 0, stone: 0, gold: 0 };
const lv = (level: number, timeSec: number, requirements: CatalogEntry['levels'][0]['requirements'] = []) =>
  ({ level, requirements, cost: { ...cost0, food: level * 100 }, timeSec, power: level * 10 });

/** hall(3레벨) ← wall(2레벨) 선행, academy(2) ← hall2, tech masonry(2) ← academy1 */
export const fixtureCatalog: CatalogEntry[] = [
  { id: 'hall', kind: 'building', category: 'other', maxLevel: 3, levels: [
    lv(1, 0),
    lv(2, 100, [{ type: 'building', id: 'wall', level: 1 }]),
    lv(3, 200, [{ type: 'building', id: 'wall', level: 2 }, { type: 'building', id: 'academy', level: 1 }]),
  ]},
  { id: 'wall', kind: 'building', category: 'other', maxLevel: 2, levels: [lv(1, 50), lv(2, 60)] },
  { id: 'academy', kind: 'building', category: 'economic', maxLevel: 2, levels: [
    lv(1, 80, [{ type: 'building', id: 'hall', level: 2 }]), lv(2, 90),
  ]},
  { id: 'masonry', kind: 'research', category: 'economic', maxLevel: 2, levels: [
    lv(1, 40, [{ type: 'building', id: 'academy', level: 1 }]), lv(2, 70),
  ]},
];

export const freshState = (): UserState => ({
  buildings: { hall: 1 },
  research: {},
  speedups: emptySpeedups(),
  buffs: { buildingSpeedPct: 0, researchSpeedPct: 0 },
  secondBuilder: false,
});
```

- [ ] **Step 2: closure 실패 테스트 작성**

`web/src/engine/__tests__/closure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { nodeId } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);

describe('requiredNodes', () => {
  it('목표 hall3 → 전이 선행(wall1..2, academy1, hall2..3) 전부 포함', () => {
    const nodes = requiredNodes(index, [{ type: 'building', id: 'hall', level: 3 }], freshState());
    expect([...nodes.keys()].sort()).toEqual([
      nodeId('building', 'academy', 1),
      nodeId('building', 'hall', 2),
      nodeId('building', 'hall', 3),
      nodeId('building', 'wall', 1),
      nodeId('building', 'wall', 2),
    ].sort());
  });

  it('이미 달성한 레벨은 제외되고 deps에서도 빠진다', () => {
    const state = freshState();
    state.buildings.wall = 2;
    state.buildings.hall = 2;
    const nodes = requiredNodes(index, [{ type: 'building', id: 'hall', level: 3 }], state);
    expect([...nodes.keys()].sort()).toEqual([
      nodeId('building', 'academy', 1),
      nodeId('building', 'hall', 3),
    ].sort());
    const hall3 = nodes.get(nodeId('building', 'hall', 3))!;
    expect(hall3.deps).toEqual([nodeId('building', 'academy', 1)]); // wall2는 달성됨
  });

  it('연구 목표는 건물 선행도 끌고 온다', () => {
    const nodes = requiredNodes(index, [{ type: 'research', id: 'masonry', level: 1 }], freshState());
    expect(nodes.has(nodeId('building', 'academy', 1))).toBe(true);
    expect(nodes.has(nodeId('building', 'hall', 2))).toBe(true);
  });

  it('달성 완료 목표는 빈 결과', () => {
    const state = freshState();
    state.buildings.hall = 3;
    state.buildings.wall = 2;
    state.buildings.academy = 1;
    const nodes = requiredNodes(index, [{ type: 'building', id: 'hall', level: 3 }], state);
    expect(nodes.size).toBe(0);
  });
});
```

- [ ] **Step 3: 테스트 실행, 실패 확인**

Run: `cd web && npx vitest run src/engine/__tests__/closure.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: graph.ts + closure.ts 구현**

`web/src/engine/graph.ts`:
```ts
import type { CatalogEntry, NodeKind, TaskNode } from './types';
import { nodeId } from './types';

export interface CatalogIndex {
  get(kind: NodeKind, id: string): CatalogEntry | undefined;
  makeNode(kind: NodeKind, id: string, level: number): TaskNode;
  all(): CatalogEntry[];
}

export function buildIndex(entries: CatalogEntry[]): CatalogIndex {
  const map = new Map<string, CatalogEntry>();
  for (const e of entries) map.set(`${e.kind}:${e.id}`, e);

  const get = (kind: NodeKind, id: string) => map.get(`${kind}:${id}`);

  const makeNode = (kind: NodeKind, id: string, level: number): TaskNode => {
    const entry = get(kind, id);
    const row = entry?.levels.find((l) => l.level === level);
    if (!entry || !row) throw new Error(`unknown node ${kind}:${id}:${level}`);
    const deps: string[] = [];
    if (level > 1) deps.push(nodeId(kind, id, level - 1));
    for (const req of row.requirements) {
      if (get(req.type, req.id)) deps.push(nodeId(req.type, req.id, req.level));
    }
    return { key: nodeId(kind, id, level), kind, id, level,
             timeSec: row.timeSec, cost: row.cost, power: row.power, deps };
  };

  return { get, makeNode, all: () => entries };
}
```

`web/src/engine/closure.ts`:
```ts
import type { CatalogIndex } from './graph';
import type { Goal, NodeId, NodeKind, TaskNode, UserState } from './types';
import { nodeId } from './types';

const achievedLevel = (state: UserState, kind: NodeKind, id: string): number =>
  (kind === 'building' ? state.buildings[id] : state.research[id]) ?? 0;

/** 목표 달성에 필요한 미완료 노드 전체(전이 폐포). deps는 미완료 노드로만 필터된다. */
export function requiredNodes(
  index: CatalogIndex, goals: Goal[], state: UserState,
): Map<NodeId, TaskNode> {
  const result = new Map<NodeId, TaskNode>();
  const stack: Array<{ kind: NodeKind; id: string; level: number }> = [];

  const push = (kind: NodeKind, id: string, level: number) => {
    const from = achievedLevel(state, kind, id);
    for (let l = from + 1; l <= level; l++) {
      if (!result.has(nodeId(kind, id, l))) stack.push({ kind, id, level: l });
    }
  };

  for (const g of goals) push(g.type, g.id, g.level);

  while (stack.length > 0) {
    const { kind, id, level } = stack.pop()!;
    const key = nodeId(kind, id, level);
    if (result.has(key)) continue;
    const node = index.makeNode(kind, id, level);
    result.set(key, node);
    const entry = index.get(kind, id)!;
    const row = entry.levels.find((l) => l.level === level)!;
    if (level > 1 && achievedLevel(state, kind, id) < level - 1) push(kind, id, level - 1);
    for (const req of row.requirements) {
      if (index.get(req.type, req.id) && achievedLevel(state, req.type, req.id) < req.level) {
        push(req.type, req.id, req.level);
      }
    }
  }

  // deps를 미완료 노드로 한정
  for (const node of result.values()) {
    node.deps = node.deps.filter((d) => result.has(d));
  }
  return result;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd web && npx vitest run src/engine/__tests__/closure.test.ts`
Expected: PASS (4건)

- [ ] **Step 6: Commit**

```bash
git add web/src/engine/
git commit -m "feat: 엔진 — 카탈로그 인덱스와 목표 폐포"
```

---

### Task 9: 엔진 — 크리티컬 패스 가중치 + 스케줄러

**Files:**
- Create: `web/src/engine/critical.ts`, `web/src/engine/scheduler.ts`
- Test: `web/src/engine/__tests__/scheduler.test.ts`

**Interfaces:**
- Consumes: Task 8의 `requiredNodes` 결과 `Map<NodeId, TaskNode>`
- Produces:
  - `critical.ts`: `criticalWeights(nodes: Map<NodeId, TaskNode>, dur: (n: TaskNode) => number): Map<NodeId, number>` — 각 노드에서 시작하는 최장 경로 총시간(자기 시간 포함)
  - `scheduler.ts`:
    ```ts
    interface ScheduleOptions { builders: number; buildingSpeedPct: number; researchSpeedPct: number; durationOverride?: Map<NodeId, number> }
    interface ScheduledTask { key: NodeId; kind: NodeKind; queue: number; startSec: number; endSec: number; durationSec: number }
    function effectiveDuration(node: TaskNode, opts: ScheduleOptions): number
    function schedule(nodes: Map<NodeId, TaskNode>, opts: ScheduleOptions): ScheduledTask[]
    ```
    큐 번호: 0..builders-1 = 건설, builders = 연구.

- [ ] **Step 1: 실패 테스트 작성**

`web/src/engine/__tests__/scheduler.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { schedule } from '../scheduler';
import { nodeId } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);
const opts = { builders: 1, buildingSpeedPct: 0, researchSpeedPct: 0 };
const goalHall3 = [{ type: 'building' as const, id: 'hall', level: 3 }];

describe('schedule', () => {
  it('선행조건 위반 없음: 모든 태스크는 deps 완료 후 시작', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, opts);
    const endOf = new Map(tasks.map((t) => [t.key, t.endSec]));
    for (const t of tasks) {
      for (const d of nodes.get(t.key)!.deps) {
        expect(t.startSec).toBeGreaterThanOrEqual(endOf.get(d)!);
      }
    }
  });

  it('건설자 1명 직렬: 총시간 = 모든 건설 시간 합', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, opts);
    // wall1(50)+wall2(60)+hall2(100)+academy1(80)+hall3(200) = 490
    expect(Math.max(...tasks.map((t) => t.endSec))).toBe(490);
  });

  it('건설자 2명이면 병렬화로 단축된다', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, { ...opts, builders: 2 });
    expect(Math.max(...tasks.map((t) => t.endSec))).toBeLessThan(490);
  });

  it('연구는 연구 큐에서 건설과 병렬 진행', () => {
    const nodes = requiredNodes(index,
      [...goalHall3, { type: 'research' as const, id: 'masonry', level: 2 }], freshState());
    const tasks = schedule(nodes, opts);
    const masonry1 = tasks.find((t) => t.key === nodeId('research', 'masonry', 1))!;
    const academy1 = tasks.find((t) => t.key === nodeId('building', 'academy', 1))!;
    expect(masonry1.queue).toBe(1); // builders=1 → 연구 큐 번호 1
    expect(masonry1.startSec).toBeGreaterThanOrEqual(academy1.endSec);
  });

  it('건설 버프 100%면 건설 시간 절반', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, { ...opts, buildingSpeedPct: 100 });
    expect(Math.max(...tasks.map((t) => t.endSec))).toBe(245);
  });
});
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

Run: `cd web && npx vitest run src/engine/__tests__/scheduler.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: critical.ts 구현**

`web/src/engine/critical.ts`:
```ts
import type { NodeId, TaskNode } from './types';

/** 각 노드에 대해 "이 노드부터 최종 후속까지의 최장 경로 시간" (자기 시간 포함).
 *  스케줄러가 이 값이 큰 작업부터 큐에 넣는다. */
export function criticalWeights(
  nodes: Map<NodeId, TaskNode>, dur: (n: TaskNode) => number,
): Map<NodeId, number> {
  const memo = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>();
  for (const n of nodes.values()) {
    for (const d of n.deps) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(n.key);
    }
  }
  const weight = (key: NodeId): number => {
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const node = nodes.get(key)!;
    const next = dependents.get(key) ?? [];
    const best = next.length === 0 ? 0 : Math.max(...next.map(weight));
    const w = dur(node) + best;
    memo.set(key, w);
    return w;
  };
  for (const key of nodes.keys()) weight(key);
  return memo;
}
```

- [ ] **Step 4: scheduler.ts 구현**

`web/src/engine/scheduler.ts`:
```ts
import { criticalWeights } from './critical';
import type { NodeId, NodeKind, TaskNode } from './types';

export interface ScheduleOptions {
  builders: number;               // 1 또는 2
  buildingSpeedPct: number;
  researchSpeedPct: number;
  durationOverride?: Map<NodeId, number>; // 가속 적용 후 시간 (speedups.ts가 사용)
}

export interface ScheduledTask {
  key: NodeId; kind: NodeKind; queue: number;
  startSec: number; endSec: number; durationSec: number;
}

export function effectiveDuration(node: TaskNode, opts: ScheduleOptions): number {
  const override = opts.durationOverride?.get(node.key);
  if (override !== undefined) return override;
  const pct = node.kind === 'building' ? opts.buildingSpeedPct : opts.researchSpeedPct;
  return Math.ceil(node.timeSec / (1 + pct / 100));
}

/** 이산 사건 시뮬레이션. 큐 0..builders-1 = 건설, builders = 연구. */
export function schedule(
  nodes: Map<NodeId, TaskNode>, opts: ScheduleOptions,
): ScheduledTask[] {
  const dur = (n: TaskNode) => effectiveDuration(n, opts);
  const weights = criticalWeights(nodes, dur);

  const pendingDeps = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>();
  for (const n of nodes.values()) {
    pendingDeps.set(n.key, n.deps.length);
    for (const d of n.deps) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(n.key);
    }
  }

  const ready: Record<NodeKind, NodeId[]> = { building: [], research: [] };
  const pushReady = (key: NodeId) => {
    const kind = nodes.get(key)!.kind;
    ready[kind].push(key);
    ready[kind].sort((a, b) => weights.get(b)! - weights.get(a)!); // 가중치 큰 순
  };
  for (const n of nodes.values()) if (n.deps.length === 0) pushReady(n.key);

  const queueCount = opts.builders + 1;
  const queueFreeAt = new Array<number>(queueCount).fill(0);
  const queueKind = (q: number): NodeKind => (q < opts.builders ? 'building' : 'research');
  const running: Array<{ task: ScheduledTask } | null> = new Array(queueCount).fill(null);
  const result: ScheduledTask[] = [];
  let done = 0;
  let now = 0;

  const tryStart = () => {
    for (let q = 0; q < queueCount; q++) {
      if (running[q] !== null || queueFreeAt[q] > now) continue;
      const kind = queueKind(q);
      const key = ready[kind].shift();
      if (key === undefined) continue;
      const node = nodes.get(key)!;
      const d = dur(node);
      const task: ScheduledTask = {
        key, kind, queue: q, startSec: now, endSec: now + d, durationSec: d,
      };
      running[q] = { task };
      result.push(task);
    }
  };

  tryStart();
  while (done < nodes.size) {
    const active = running.filter((r): r is { task: ScheduledTask } => r !== null);
    if (active.length === 0) throw new Error('deadlock: no runnable task (cycle in deps?)');
    now = Math.min(...active.map((r) => r.task.endSec));
    for (let q = 0; q < queueCount; q++) {
      const r = running[q];
      if (r && r.task.endSec <= now) {
        running[q] = null;
        queueFreeAt[q] = now;
        done++;
        for (const dep of dependents.get(r.task.key) ?? []) {
          const left = pendingDeps.get(dep)! - 1;
          pendingDeps.set(dep, left);
          if (left === 0) pushReady(dep);
        }
      }
    }
    tryStart();
  }
  return result.sort((a, b) => a.startSec - b.startSec);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd web && npx vitest run src/engine/__tests__/scheduler.test.ts`
Expected: PASS (5건)

- [ ] **Step 6: Commit**

```bash
git add web/src/engine/
git commit -m "feat: 엔진 — 크리티컬 패스 스케줄러"
```

---

### Task 10: 엔진 — 가속 배분 + computePlan 오케스트레이터

**Files:**
- Create: `web/src/engine/speedups.ts`, `web/src/engine/plan.ts`
- Test: `web/src/engine/__tests__/speedups.test.ts`, `web/src/engine/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: Task 8–9 전부
- Produces:
  - `speedups.ts`:
    ```ts
    interface SpeedupAllocation {
      finalTasks: ScheduledTask[];
      used: Record<NodeId, Partial<Record<SpeedupType, Record<string, number>>>>;
      remaining: SpeedupInventory;
    }
    function allocateSpeedups(nodes: Map<NodeId, TaskNode>, inventory: SpeedupInventory, opts: ScheduleOptions): SpeedupAllocation
    ```
  - `plan.ts`:
    ```ts
    interface Plan {
      tasks: Array<ScheduledTask & { node: TaskNode }>;
      totalSecRaw: number;          // 가속 미적용 총시간
      totalSecWithSpeedups: number;
      totalCost: Cost;
      totalPower: number;
      speedupsUsed: SpeedupAllocation['used'];
      speedupsRemaining: SpeedupInventory;
    }
    function computePlan(catalog: CatalogEntry[], state: UserState, goals: Goal[]): Plan
    ```

- [ ] **Step 1: 실패 테스트 작성**

`web/src/engine/__tests__/speedups.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { allocateSpeedups } from '../speedups';
import { emptySpeedups } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);
const opts = { builders: 1, buildingSpeedPct: 0, researchSpeedPct: 0 };
const goal = [{ type: 'building' as const, id: 'hall', level: 3 }];
const makespan = (tasks: { endSec: number }[]) => Math.max(...tasks.map((t) => t.endSec));

describe('allocateSpeedups', () => {
  it('가속 없음 → 원래 스케줄 그대로', () => {
    const nodes = requiredNodes(index, goal, freshState());
    const r = allocateSpeedups(nodes, emptySpeedups(), opts);
    expect(makespan(r.finalTasks)).toBe(490);
  });

  it('건설 가속이 총시간을 줄이고, 사용량이 기록된다', () => {
    const nodes = requiredNodes(index, goal, freshState());
    const inv = emptySpeedups();
    inv.building = { '1m': 3 }; // 180초어치
    const r = allocateSpeedups(nodes, inv, opts);
    expect(makespan(r.finalTasks)).toBe(490 - 180);
    expect(Object.keys(r.used).length).toBeGreaterThan(0);
    expect(r.remaining.building['1m'] ?? 0).toBe(0);
  });

  it('작업 시간을 초과하는 가속은 쓰지 않는다 (낭비 방지)', () => {
    const nodes = requiredNodes(index, goal, freshState());
    const inv = emptySpeedups();
    inv.building = { '30d': 1 }; // 어떤 단일 작업(최대 200초)보다 큼 → 사용 불가
    const r = allocateSpeedups(nodes, inv, opts);
    expect(makespan(r.finalTasks)).toBe(490);
    expect(r.remaining.building['30d']).toBe(1);
  });

  it('연구 가속은 건설 작업에 쓰이지 않는다', () => {
    const nodes = requiredNodes(index, goal, freshState()); // 건설만 있는 목표
    const inv = emptySpeedups();
    inv.research = { '1m': 10 };
    const r = allocateSpeedups(nodes, inv, opts);
    expect(makespan(r.finalTasks)).toBe(490);
    expect(r.remaining.research['1m']).toBe(10);
  });
});
```

`web/src/engine/__tests__/plan.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computePlan } from '../plan';
import { fixtureCatalog, freshState } from './fixtures';

describe('computePlan', () => {
  it('총 비용/파워/시간 집계가 맞다', () => {
    const plan = computePlan(fixtureCatalog, freshState(),
      [{ type: 'building', id: 'hall', level: 3 }]);
    // wall1+wall2+hall2+academy1+hall3 = food (100+200+200+100+300) = 900
    expect(plan.totalCost.food).toBe(900);
    expect(plan.totalPower).toBe(90);
    expect(plan.totalSecRaw).toBe(490);
    expect(plan.tasks).toHaveLength(5);
    expect(plan.tasks[0].node).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

Run: `cd web && npx vitest run src/engine/__tests__/speedups.test.ts src/engine/__tests__/plan.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: speedups.ts 구현**

`web/src/engine/speedups.ts`:
```ts
import type { ScheduleOptions, ScheduledTask } from './scheduler';
import { effectiveDuration, schedule } from './scheduler';
import type { NodeId, SpeedupInventory, SpeedupType, TaskNode } from './types';
import { SPEEDUP_DURATIONS } from './types';

export interface SpeedupAllocation {
  finalTasks: ScheduledTask[];
  used: Record<NodeId, Partial<Record<SpeedupType, Record<string, number>>>>;
  remaining: SpeedupInventory;
}

const MAX_ITER = 200;

/** 크리티컬 체인(makespan을 결정하는 작업 사슬)을 끝에서부터 역추적. */
function criticalChain(tasks: ScheduledTask[], nodes: Map<NodeId, TaskNode>): ScheduledTask[] {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const makespan = Math.max(...tasks.map((t) => t.endSec));
  let current = tasks.find((t) => t.endSec === makespan)!;
  const chain = [current];
  while (current.startSec > 0) {
    // 시작을 막은 원인: (a) 완료가 startSec와 일치하는 dep, (b) 같은 큐에서 직전에 끝난 작업
    const deps = nodes.get(current.key)!.deps.map((d) => byKey.get(d)!).filter(Boolean);
    const blocker = deps.find((d) => d.endSec === current.startSec)
      ?? tasks.find((t) => t.queue === current.queue && t.endSec === current.startSec);
    if (!blocker) break;
    chain.push(blocker);
    current = blocker;
  }
  return chain;
}

/** 인벤토리에서 작업 하나에 그리디(큰 단위 우선, 초과 금지)로 가속 적용. 줄인 초를 반환. */
function applyToTask(
  duration: number, kinds: SpeedupType[], remaining: SpeedupInventory,
  usedForTask: Partial<Record<SpeedupType, Record<string, number>>>,
): number {
  let left = duration;
  const unitsDesc = Object.entries(SPEEDUP_DURATIONS).sort((a, b) => b[1] - a[1]);
  for (const kind of kinds) {
    for (const [unitId, unitSec] of unitsDesc) {
      while ((remaining[kind][unitId] ?? 0) > 0 && unitSec <= left) {
        remaining[kind][unitId]!--;
        const bucket = (usedForTask[kind] ??= {});
        bucket[unitId] = (bucket[unitId] ?? 0) + 1;
        left -= unitSec;
      }
    }
  }
  return duration - left;
}

export function allocateSpeedups(
  nodes: Map<NodeId, TaskNode>, inventory: SpeedupInventory, opts: ScheduleOptions,
): SpeedupAllocation {
  const remaining: SpeedupInventory = {
    universal: { ...inventory.universal },
    building: { ...inventory.building },
    research: { ...inventory.research },
  };
  const used: SpeedupAllocation['used'] = {};
  const override = new Map<NodeId, number>(opts.durationOverride ?? []);
  const optsWith = () => ({ ...opts, durationOverride: override });

  let tasks = schedule(nodes, optsWith());
  const failed = new Set<NodeId>();

  for (let i = 0; i < MAX_ITER; i++) {
    const chain = criticalChain(tasks, nodes)
      .filter((t) => !failed.has(t.key))
      .sort((a, b) => b.durationSec - a.durationSec);
    let improved = false;
    for (const t of chain) {
      const node = nodes.get(t.key)!;
      const current = override.get(t.key) ?? effectiveDuration(node, opts);
      if (current <= 0) continue;
      const kinds: SpeedupType[] =
        node.kind === 'building' ? ['building', 'universal'] : ['research', 'universal'];
      const usedForTask = used[t.key] ?? {};
      const reduced = applyToTask(current, kinds, remaining, usedForTask);
      if (reduced > 0) {
        used[t.key] = usedForTask;
        override.set(t.key, current - reduced);
        improved = true;
        break; // 스케줄 재계산 후 다음 크리티컬 체인으로
      }
      failed.add(t.key);
    }
    if (!improved) break;
    tasks = schedule(nodes, optsWith());
  }
  return { finalTasks: tasks, used, remaining };
}
```

- [ ] **Step 4: plan.ts 구현**

`web/src/engine/plan.ts`:
```ts
import { requiredNodes } from './closure';
import { buildIndex } from './graph';
import type { ScheduledTask } from './scheduler';
import { schedule } from './scheduler';
import type { SpeedupAllocation } from './speedups';
import { allocateSpeedups } from './speedups';
import type { CatalogEntry, Cost, Goal, SpeedupInventory, TaskNode, UserState } from './types';

export interface Plan {
  tasks: Array<ScheduledTask & { node: TaskNode }>;
  totalSecRaw: number;
  totalSecWithSpeedups: number;
  totalCost: Cost;
  totalPower: number;
  speedupsUsed: SpeedupAllocation['used'];
  speedupsRemaining: SpeedupInventory;
}

export function computePlan(catalog: CatalogEntry[], state: UserState, goals: Goal[]): Plan {
  const index = buildIndex(catalog);
  const nodes = requiredNodes(index, goals, state);
  const opts = {
    builders: state.secondBuilder ? 2 : 1,
    buildingSpeedPct: state.buffs.buildingSpeedPct,
    researchSpeedPct: state.buffs.researchSpeedPct,
  };

  const totalCost: Cost = { food: 0, wood: 0, stone: 0, gold: 0 };
  let totalPower = 0;
  for (const n of nodes.values()) {
    for (const k of Object.keys(totalCost) as Array<keyof Cost>) totalCost[k] += n.cost[k];
    totalPower += n.power;
  }

  if (nodes.size === 0) {
    return { tasks: [], totalSecRaw: 0, totalSecWithSpeedups: 0, totalCost, totalPower,
             speedupsUsed: {}, speedupsRemaining: state.speedups };
  }

  const rawTasks = schedule(nodes, opts);
  const totalSecRaw = Math.max(...rawTasks.map((t) => t.endSec));
  const { finalTasks, used, remaining } = allocateSpeedups(nodes, state.speedups, opts);

  return {
    tasks: finalTasks.map((t) => ({ ...t, node: nodes.get(t.key)! })),
    totalSecRaw,
    totalSecWithSpeedups: Math.max(...finalTasks.map((t) => t.endSec)),
    totalCost, totalPower,
    speedupsUsed: used, speedupsRemaining: remaining,
  };
}
```

- [ ] **Step 5: 전체 엔진 테스트 통과 확인**

Run: `cd web && npm test`
Expected: PASS (closure 4 + scheduler 5 + speedups 4 + plan 1)

- [ ] **Step 6: 실데이터 스모크 — 시청 25 플랜이 돌아가는지**

`web/src/engine/__tests__/realdata.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import buildingsJson from '../../data/buildings.json';
import researchJson from '../../data/research.json';
import { computePlan } from '../plan';
import type { CatalogEntry } from '../types';
import { defaultUserState } from '../types';

const catalog: CatalogEntry[] = [
  ...(buildingsJson as any[]).map((b) => ({ ...b, kind: 'building' as const })),
  ...(researchJson as any[]).map((r) => ({ ...r, kind: 'research' as const, category: r.tree })),
];

describe('실데이터', () => {
  it('시청 25 플랜: 선행 위반 없이 완주, 총시간 > 0', () => {
    const plan = computePlan(catalog, defaultUserState(),
      [{ type: 'building', id: 'city_hall', level: 25 }]);
    expect(plan.tasks.length).toBeGreaterThan(50);
    expect(plan.totalSecRaw).toBeGreaterThan(0);
    const endOf = new Map(plan.tasks.map((t) => [t.key, t.endSec]));
    for (const t of plan.tasks) {
      for (const d of t.node.deps) {
        expect(t.startSec).toBeGreaterThanOrEqual(endOf.get(d)!);
      }
    }
  });
});
```

Run: `cd web && npm test`
Expected: PASS. tsconfig에 `"resolveJsonModule": true` 필요 시 추가.

- [ ] **Step 7: Commit**

```bash
git add web/src/engine/ web/tsconfig*.json
git commit -m "feat: 엔진 — 가속 배분과 플랜 오케스트레이터"
```

---

### Task 11: 상태 관리 + i18n 기반

**Files:**
- Create: `web/src/state/userState.ts`, `web/src/i18n/index.tsx`, `web/src/i18n/ui.ko.ts`, `web/src/i18n/ui.en.ts`

**Interfaces:**
- Consumes: `engine/types.ts`, `data/names.*.json`
- Produces:
  - `userState.ts`: `useUserState(): [UserState, Dispatch<Action>]` — reducer + localStorage 영속화. Actions: `{type:'setBuilding',id,level}`, `{type:'setResearch',id,level}`, `{type:'setSpeedup',speedupType,duration,count}`, `{type:'setBuff',key,value}`, `{type:'setSecondBuilder',value}`, `{type:'reset'}`
  - `i18n/index.tsx`: `LangProvider`, `useLang(): { lang: 'ko'|'en'; setLang; t(key: string): string; name(id: string): string }` — `name()`은 ko 우선, 없으면 en 폴백

- [ ] **Step 1: userState 구현**

`web/src/state/userState.ts`:
```ts
import { useEffect, useReducer } from 'react';
import type { SpeedupType, UserState } from '../engine/types';
import { defaultUserState } from '../engine/types';

const STORAGE_KEY = 'rok-calculator-state-v1';

export type Action =
  | { type: 'setBuilding'; id: string; level: number }
  | { type: 'setResearch'; id: string; level: number }
  | { type: 'setSpeedup'; speedupType: SpeedupType; duration: string; count: number }
  | { type: 'setBuff'; key: 'buildingSpeedPct' | 'researchSpeedPct'; value: number }
  | { type: 'setSecondBuilder'; value: boolean }
  | { type: 'reset' };

function reducer(state: UserState, action: Action): UserState {
  switch (action.type) {
    case 'setBuilding':
      return { ...state, buildings: { ...state.buildings, [action.id]: action.level } };
    case 'setResearch':
      return { ...state, research: { ...state.research, [action.id]: action.level } };
    case 'setSpeedup':
      return { ...state, speedups: { ...state.speedups,
        [action.speedupType]: { ...state.speedups[action.speedupType], [action.duration]: action.count } } };
    case 'setBuff':
      return { ...state, buffs: { ...state.buffs, [action.key]: action.value } };
    case 'setSecondBuilder':
      return { ...state, secondBuilder: action.value };
    case 'reset':
      return defaultUserState();
  }
}

function load(): UserState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultUserState(), ...JSON.parse(raw) };
  } catch { /* 손상된 저장값은 무시 */ }
  return defaultUserState();
}

export function useUserState() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  return [state, dispatch] as const;
}
```

- [ ] **Step 2: i18n 구현**

`web/src/i18n/ui.ko.ts`:
```ts
export default {
  'tab.city': '내 도시',
  'tab.goals': '목표 설정',
  'tab.result': '결과',
  'city.buildings': '건물',
  'city.research': '연구',
  'city.speedups': '가속 아이템',
  'city.buffs': '버프',
  'city.buildingSpeed': '건설 속도 보너스 (%)',
  'city.researchSpeed': '연구 속도 보너스 (%)',
  'city.secondBuilder': '2번째 건설자',
  'city.reset': '초기화 (신규 계정)',
  'speedup.universal': '범용',
  'speedup.building': '건설',
  'speedup.research': '연구',
  'goals.presets': '프리셋',
  'goals.custom': '직접 선택',
  'goals.cityHallTo': '시청 {n}',
  'goals.add': '목표 추가',
  'goals.remove': '삭제',
  'goals.empty': '목표를 추가하세요',
  'result.totalTime': '총 소요 시간',
  'result.beforeSpeedups': '가속 전',
  'result.afterSpeedups': '가속 후',
  'result.totalCost': '총 자원',
  'result.totalPower': '획득 파워',
  'result.timeline': '진행 순서',
  'result.start': '시작',
  'result.duration': '소요',
  'result.queue.builder1': '건설 1',
  'result.queue.builder2': '건설 2',
  'result.queue.research': '연구',
  'result.speedupsUsed': '가속 사용 내역',
  'result.noGoals': '목표 탭에서 목표를 먼저 설정하세요',
  'result.done': '모든 목표를 이미 달성했습니다',
  'unit.day': '일', 'unit.hour': '시간', 'unit.min': '분', 'unit.sec': '초',
  'res.food': '식량', 'res.wood': '목재', 'res.stone': '석재', 'res.gold': '금화',
  'tree.economic': '경제', 'tree.military': '군사', 'category.other': '기타',
  'level': 'Lv.',
} as Record<string, string>;
```

`web/src/i18n/ui.en.ts` (ko 파일과 키 집합 동일):
```ts
export default {
  'tab.city': 'My City',
  'tab.goals': 'Goals',
  'tab.result': 'Result',
  'city.buildings': 'Buildings',
  'city.research': 'Research',
  'city.speedups': 'Speedups',
  'city.buffs': 'Buffs',
  'city.buildingSpeed': 'Building speed bonus (%)',
  'city.researchSpeed': 'Research speed bonus (%)',
  'city.secondBuilder': 'Second builder',
  'city.reset': 'Reset (new account)',
  'speedup.universal': 'Universal',
  'speedup.building': 'Building',
  'speedup.research': 'Research',
  'goals.presets': 'Presets',
  'goals.custom': 'Custom',
  'goals.cityHallTo': 'City Hall {n}',
  'goals.add': 'Add goal',
  'goals.remove': 'Remove',
  'goals.empty': 'Add a goal to get started',
  'result.totalTime': 'Total time',
  'result.beforeSpeedups': 'Before speedups',
  'result.afterSpeedups': 'After speedups',
  'result.totalCost': 'Total resources',
  'result.totalPower': 'Power gained',
  'result.timeline': 'Build order',
  'result.start': 'Start',
  'result.duration': 'Duration',
  'result.queue.builder1': 'Builder 1',
  'result.queue.builder2': 'Builder 2',
  'result.queue.research': 'Research',
  'result.speedupsUsed': 'Speedups used',
  'result.noGoals': 'Set goals in the Goals tab first',
  'result.done': 'All goals already achieved',
  'unit.day': 'd', 'unit.hour': 'h', 'unit.min': 'm', 'unit.sec': 's',
  'res.food': 'Food', 'res.wood': 'Wood', 'res.stone': 'Stone', 'res.gold': 'Gold',
  'tree.economic': 'Economic', 'tree.military': 'Military', 'category.other': 'Other',
  'level': 'Lv.',
} as Record<string, string>;
```

`web/src/i18n/index.tsx`:
```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import namesEn from '../data/names.en.json';
import namesKo from '../data/names.ko.json';
import en from './ui.en';
import ko from './ui.ko';

type Lang = 'ko' | 'en';
const dicts: Record<Lang, Record<string, string>> = { ko, en };
const names: Record<Lang, Record<string, string>> = {
  ko: namesKo as Record<string, string>, en: namesEn as Record<string, string>,
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  name: (id: string) => string;
}
const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangRaw] = useState<Lang>(() =>
    (localStorage.getItem('rok-lang') as Lang) ?? 'ko');
  const setLang = (l: Lang) => { localStorage.setItem('rok-lang', l); setLangRaw(l); };
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dicts[lang][key] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  const name = (id: string) => names[lang][id] ?? names.en[id] ?? id;
  return <Ctx.Provider value={{ lang, setLang, t, name }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang outside LangProvider');
  return ctx;
}
```

- [ ] **Step 3: 타입체크 통과 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add web/src/state/ web/src/i18n/
git commit -m "feat: 사용자 상태 관리와 i18n"
```

---

### Task 12: UI — App 골격 + 내 도시 탭

**Files:**
- Create: `web/src/ui/App.tsx`, `web/src/ui/CityTab.tsx`, `web/src/ui/ResearchTree.tsx`, `web/src/ui/SpeedupPanel.tsx`, `web/src/styles.css`, `web/src/catalog.ts`
- Modify: `web/src/main.tsx` (App 교체), `web/index.html` (title)
- Delete: Vite 템플릿 잔재 (`App.css`, 기본 `App.tsx` 내용, 로고 svg)

**Interfaces:**
- Consumes: `useUserState`, `useLang`, `engine/types`
- Produces: `catalog.ts`의 `export const catalog: CatalogEntry[]`, `export const buildings: CatalogEntry[]`, `export const research: CatalogEntry[]` (JSON 로드 + kind 부여, 이후 탭들이 공용)

- [ ] **Step 1: catalog.ts + App 골격 작성**

`web/src/catalog.ts`:
```ts
import buildingsJson from './data/buildings.json';
import researchJson from './data/research.json';
import type { CatalogEntry } from './engine/types';

export const buildings: CatalogEntry[] = (buildingsJson as any[]).map(
  (b) => ({ ...b, kind: 'building' as const }));
export const research: CatalogEntry[] = (researchJson as any[]).map(
  (r) => ({ ...r, kind: 'research' as const, category: r.tree }));
export const catalog: CatalogEntry[] = [...buildings, ...research];

export const iconUrl = (kind: 'building' | 'research', id: string) =>
  `${import.meta.env.BASE_URL}icons/${kind === 'building' ? 'buildings' : 'research'}/${id}.png`;
```

`web/src/ui/App.tsx`:
```tsx
import { useState } from 'react';
import type { Goal } from '../engine/types';
import { LangProvider, useLang } from '../i18n';
import { useUserState } from '../state/userState';
import { CityTab } from './CityTab';
import { GoalsTab } from './GoalsTab';
import { ResultTab } from './ResultTab';

function Shell() {
  const { t, lang, setLang } = useLang();
  const [state, dispatch] = useUserState();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tab, setTab] = useState<'city' | 'goals' | 'result'>('city');

  return (
    <div className="app">
      <header>
        <h1>RoK Calculator</h1>
        <nav>
          {(['city', 'goals', 'result'] as const).map((id) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {t(`tab.${id}`)}
            </button>
          ))}
        </nav>
        <button className="lang" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>
          {lang === 'ko' ? 'EN' : '한국어'}
        </button>
      </header>
      <main>
        {tab === 'city' && <CityTab state={state} dispatch={dispatch} />}
        {tab === 'goals' && <GoalsTab goals={goals} setGoals={setGoals} />}
        {tab === 'result' && <ResultTab state={state} goals={goals} />}
      </main>
    </div>
  );
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>;
}
```

`web/src/main.tsx`에서 `./ui/App` import로 교체, `styles.css` import. `index.html` title을 `RoK Calculator`로. GoalsTab/ResultTab은 이 태스크에서는 빈 껍데기로 두면 안 되고 — Task 13/14에서 만들므로, 이 태스크에서는 임시로 `export const GoalsTab = () => null` 식의 스텁 대신 **Task 13/14 파일을 먼저 빈 유효 컴포넌트로 만들지 말고**, App.tsx에서 city 탭만 렌더하도록 잠시 주석 처리한다. (Task 14 완료 시 주석 해제 단계 있음.)

- [ ] **Step 2: CityTab + ResearchTree + SpeedupPanel 작성**

`web/src/ui/CityTab.tsx`:
```tsx
import type { Dispatch } from 'react';
import { buildings, iconUrl } from '../catalog';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n';
import type { Action } from '../state/userState';
import { ResearchTree } from './ResearchTree';
import { SpeedupPanel } from './SpeedupPanel';

const CATEGORIES = ['other', 'economic', 'military'] as const;

export function CityTab({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
  return (
    <div className="city-tab">
      <section>
        <h2>{t('city.buildings')}</h2>
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <h3>{t(cat === 'other' ? 'category.other' : `tree.${cat}`)}</h3>
            <div className="building-grid">
              {buildings.filter((b) => b.category === cat).map((b) => (
                <div className="card" key={b.id}>
                  <img src={iconUrl('building', b.id)} alt={name(b.id)} loading="lazy" />
                  <div className="card-name">{name(b.id)}</div>
                  <select
                    value={state.buildings[b.id] ?? 0}
                    onChange={(e) => dispatch({ type: 'setBuilding', id: b.id, level: Number(e.target.value) })}
                  >
                    {Array.from({ length: b.maxLevel + 1 }, (_, i) => (
                      <option key={i} value={i}>{t('level')}{i}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2>{t('city.research')}</h2>
        <ResearchTree state={state} dispatch={dispatch} />
      </section>
      <section>
        <h2>{t('city.speedups')}</h2>
        <SpeedupPanel state={state} dispatch={dispatch} />
      </section>
      <section>
        <h2>{t('city.buffs')}</h2>
        <label>{t('city.buildingSpeed')}
          <input type="number" min={0} max={500} value={state.buffs.buildingSpeedPct}
            onChange={(e) => dispatch({ type: 'setBuff', key: 'buildingSpeedPct', value: Number(e.target.value) })} />
        </label>
        <label>{t('city.researchSpeed')}
          <input type="number" min={0} max={500} value={state.buffs.researchSpeedPct}
            onChange={(e) => dispatch({ type: 'setBuff', key: 'researchSpeedPct', value: Number(e.target.value) })} />
        </label>
        <label>
          <input type="checkbox" checked={state.secondBuilder}
            onChange={(e) => dispatch({ type: 'setSecondBuilder', value: e.target.checked })} />
          {t('city.secondBuilder')}
        </label>
        <button onClick={() => dispatch({ type: 'reset' })}>{t('city.reset')}</button>
      </section>
    </div>
  );
}
```

`web/src/ui/ResearchTree.tsx` — 트리별로 tier 행 그리드:
```tsx
import type { Dispatch } from 'react';
import { iconUrl, research } from '../catalog';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n';
import type { Action } from '../state/userState';

export function ResearchTree({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
  const trees = ['economic', 'military'] as const;
  return (
    <div className="research-trees">
      {trees.map((tree) => {
        const items = research.filter((r) => r.category === tree);
        const tiers = [...new Set(items.map((r: any) => r.tier as number))].sort((a, b) => a - b);
        return (
          <div key={tree} className="research-tree">
            <h3>{t(`tree.${tree}`)}</h3>
            {tiers.map((tier) => (
              <div className="tier-row" key={tier}>
                {items.filter((r: any) => r.tier === tier).map((r) => (
                  <div className="card small" key={r.id}>
                    <img src={iconUrl('research', r.id)} alt={name(r.id)} loading="lazy" />
                    <div className="card-name">{name(r.id)}</div>
                    <select
                      value={state.research[r.id] ?? 0}
                      onChange={(e) => dispatch({ type: 'setResearch', id: r.id, level: Number(e.target.value) })}
                    >
                      {Array.from({ length: r.maxLevel + 1 }, (_, i) => (
                        <option key={i} value={i}>{t('level')}{i}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

`web/src/ui/SpeedupPanel.tsx`:
```tsx
import type { Dispatch } from 'react';
import type { UserState } from '../engine/types';
import { SPEEDUP_DURATIONS, type SpeedupType } from '../engine/types';
import { useLang } from '../i18n';
import type { Action } from '../state/userState';

const TYPES: SpeedupType[] = ['universal', 'building', 'research'];

export function SpeedupPanel({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t } = useLang();
  return (
    <div className="speedup-panel">
      <table>
        <thead>
          <tr><th />{Object.keys(SPEEDUP_DURATIONS).map((d) => <th key={d}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {TYPES.map((type) => (
            <tr key={type}>
              <th>{t(`speedup.${type}`)}</th>
              {Object.keys(SPEEDUP_DURATIONS).map((d) => (
                <td key={d}>
                  <input type="number" min={0} value={state.speedups[type][d] ?? 0}
                    onChange={(e) => dispatch({ type: 'setSpeedup', speedupType: type, duration: d, count: Number(e.target.value) })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: styles.css 작성 (게임풍 다크 테마)**

`web/src/styles.css` — 핵심 규칙 (전체 파일로 작성):
```css
:root {
  --bg: #1a1610; --panel: #262019; --border: #4a3b28;
  --gold: #d9a94c; --text: #e8dcc8; --muted: #9a8b73; --accent: #6da34d;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font-family: 'Segoe UI', system-ui, sans-serif; }
.app { max-width: 1100px; margin: 0 auto; padding: 0 16px 64px; }
header { display: flex; align-items: center; gap: 24px; padding: 16px 0;
  border-bottom: 2px solid var(--border); flex-wrap: wrap; }
header h1 { color: var(--gold); font-size: 1.4rem; margin: 0; }
nav button, .lang { background: var(--panel); color: var(--text);
  border: 1px solid var(--border); padding: 8px 16px; cursor: pointer; border-radius: 6px; }
nav button.active { background: var(--gold); color: #1a1610; font-weight: 700; }
.lang { margin-left: auto; }
section { background: var(--panel); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; margin: 16px 0; }
h2 { color: var(--gold); margin-top: 0; font-size: 1.1rem; }
h3 { color: var(--muted); font-size: 0.95rem; }
.building-grid, .tier-row { display: flex; flex-wrap: wrap; gap: 10px; }
.card { width: 110px; background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px; text-align: center; }
.card img { width: 56px; height: 56px; object-fit: contain; }
.card.small { width: 92px; }
.card.small img { width: 40px; height: 40px; }
.card-name { font-size: 0.75rem; min-height: 2.2em; margin: 4px 0; }
.card select, .card input { width: 100%; background: var(--panel); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px; padding: 2px; }
label { display: block; margin: 8px 0; }
input[type='number'] { width: 70px; background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px; padding: 4px; }
.speedup-panel { overflow-x: auto; }
.speedup-panel table { border-collapse: collapse; }
.speedup-panel th, .speedup-panel td { padding: 3px 5px; font-size: 0.8rem; }
.speedup-panel input { width: 52px; }
button { cursor: pointer; }
.timeline { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.timeline th, .timeline td { border-bottom: 1px solid var(--border);
  padding: 6px 8px; text-align: left; }
.timeline img { width: 24px; height: 24px; vertical-align: middle; margin-right: 6px; }
.stat-cards { display: flex; gap: 12px; flex-wrap: wrap; }
.stat-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 16px; min-width: 140px; }
.stat-card .value { color: var(--gold); font-size: 1.2rem; font-weight: 700; }
.goal-row { display: flex; gap: 8px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
.goal-row select { background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px; padding: 4px; }
.presets { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.presets button { background: var(--bg); border: 1px solid var(--gold);
  color: var(--gold); border-radius: 6px; padding: 6px 12px; }
@media (max-width: 600px) { .card { width: 30%; } header { gap: 8px; } }
```

- [ ] **Step 4: 개발 서버로 수동 스모크**

Run: `cd web && npm run dev` (백그라운드) 후 브라우저에서 `http://localhost:5173` 열기.
Expected: 내 도시 탭에 건물 아이콘 그리드 + 연구 트리 + 가속 테이블 렌더, 레벨 변경 후 새로고침해도 유지(localStorage). 콘솔 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: UI — 앱 골격과 내 도시 탭"
```

---

### Task 13: UI — 목표 설정 탭

**Files:**
- Create: `web/src/ui/GoalsTab.tsx`

**Interfaces:**
- Consumes: `catalog.ts`, `useLang`, `Goal` 타입
- Produces: `GoalsTab({ goals, setGoals }: { goals: Goal[]; setGoals: (g: Goal[]) => void })`

**범위 결정:** 스펙의 프리셋 예시 중 "T4/T5 해금"은 1차 버전에서 시청 레벨 프리셋 + 직접 선택으로 대체한다(직접 선택으로 해당 군사 연구를 목표로 지정 가능). 병종별 티어 해금 연구 id는 실데이터 확인 후 후속 작업으로 프리셋화한다.

- [ ] **Step 1: GoalsTab 구현**

`web/src/ui/GoalsTab.tsx`:
```tsx
import { useState } from 'react';
import { buildings, catalog, iconUrl, research } from '../catalog';
import type { Goal, NodeKind } from '../engine/types';
import { useLang } from '../i18n';

const CH_PRESETS = [8, 11, 16, 17, 21, 22, 25];

export function GoalsTab({ goals, setGoals }: { goals: Goal[]; setGoals: (g: Goal[]) => void }) {
  const { t, name } = useLang();
  const [kind, setKind] = useState<NodeKind>('building');
  const [id, setId] = useState('city_hall');
  const entries = kind === 'building' ? buildings : research;
  const entry = catalog.find((e) => e.kind === kind && e.id === id) ?? entries[0];
  const [level, setLevel] = useState(1);

  const addGoal = (g: Goal) => {
    const rest = goals.filter((x) => !(x.type === g.type && x.id === g.id));
    setGoals([...rest, g]);
  };

  return (
    <div>
      <section>
        <h2>{t('goals.presets')}</h2>
        <div className="presets">
          {CH_PRESETS.map((n) => (
            <button key={n} onClick={() => addGoal({ type: 'building', id: 'city_hall', level: n })}>
              {t('goals.cityHallTo', { n })}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>{t('goals.custom')}</h2>
        <div className="goal-row">
          <select value={kind} onChange={(e) => { setKind(e.target.value as NodeKind); setId(''); }}>
            <option value="building">{t('city.buildings')}</option>
            <option value="research">{t('city.research')}</option>
          </select>
          <select value={entry.id} onChange={(e) => setId(e.target.value)}>
            {entries.map((b) => <option key={b.id} value={b.id}>{name(b.id)}</option>)}
          </select>
          <select value={Math.min(level, entry.maxLevel)} onChange={(e) => setLevel(Number(e.target.value))}>
            {Array.from({ length: entry.maxLevel }, (_, i) => (
              <option key={i + 1} value={i + 1}>{t('level')}{i + 1}</option>
            ))}
          </select>
          <button onClick={() => addGoal({ type: kind, id: entry.id, level: Math.min(level, entry.maxLevel) })}>
            {t('goals.add')}
          </button>
        </div>
      </section>
      <section>
        <h2>{t('tab.goals')}</h2>
        {goals.length === 0 && <p>{t('goals.empty')}</p>}
        {goals.map((g) => (
          <div className="goal-row" key={`${g.type}:${g.id}`}>
            <img src={iconUrl(g.type, g.id)} alt="" width={28} height={28} />
            <span>{name(g.id)} {t('level')}{g.level}</span>
            <button onClick={() => setGoals(goals.filter((x) => x !== g))}>{t('goals.remove')}</button>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: App.tsx의 goals 탭 주석 해제, 수동 스모크**

Run: dev 서버에서 목표 탭 — 프리셋 클릭/직접 선택 추가/삭제 동작, 같은 대상 중복 추가 시 교체 확인.

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/
git commit -m "feat: UI — 목표 설정 탭"
```

---

### Task 14: UI — 결과 탭 (엔진 연결)

**Files:**
- Create: `web/src/ui/ResultTab.tsx`, `web/src/ui/format.ts`
- Modify: `web/src/ui/App.tsx` (result 탭 주석 해제)

**Interfaces:**
- Consumes: `computePlan`, `catalog`, `useLang`
- Produces: `ResultTab({ state, goals }: { state: UserState; goals: Goal[] })`, `format.ts`의 `formatDuration(sec: number, t): string`, `formatNumber(n: number): string`

- [ ] **Step 1: format.ts 구현**

`web/src/ui/format.ts`:
```ts
export function formatDuration(sec: number, t: (k: string) => string): string {
  if (sec <= 0) return `0${t('unit.sec')}`;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}${t('unit.day')}`);
  if (h) parts.push(`${h}${t('unit.hour')}`);
  if (m && !d) parts.push(`${m}${t('unit.min')}`);
  if (s && !d && !h) parts.push(`${s}${t('unit.sec')}`);
  return parts.join(' ');
}

export const formatNumber = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
```

- [ ] **Step 2: ResultTab 구현**

`web/src/ui/ResultTab.tsx`:
```tsx
import { useMemo } from 'react';
import { catalog, iconUrl } from '../catalog';
import { computePlan } from '../engine/plan';
import type { Goal, Resource, UserState } from '../engine/types';
import { useLang } from '../i18n';
import { formatDuration, formatNumber } from './format';

const RESOURCES: Resource[] = ['food', 'wood', 'stone', 'gold'];

export function ResultTab({ state, goals }: { state: UserState; goals: Goal[] }) {
  const { t, name } = useLang();
  const plan = useMemo(
    () => (goals.length > 0 ? computePlan(catalog, state, goals) : null),
    [state, goals]);

  if (!plan) return <section><p>{t('result.noGoals')}</p></section>;
  if (plan.tasks.length === 0) return <section><p>{t('result.done')}</p></section>;

  const queueName = (q: number) => {
    const builders = state.secondBuilder ? 2 : 1;
    if (q >= builders) return t('result.queue.research');
    return t(q === 0 ? 'result.queue.builder1' : 'result.queue.builder2');
  };

  const usedSummary: Record<string, number> = {};
  for (const perTask of Object.values(plan.speedupsUsed)) {
    for (const [type, units] of Object.entries(perTask)) {
      for (const [unit, count] of Object.entries(units as Record<string, number>)) {
        const key = `${t(`speedup.${type}`)} ${unit}`;
        usedSummary[key] = (usedSummary[key] ?? 0) + count;
      }
    }
  }

  return (
    <div>
      <section>
        <h2>{t('result.totalTime')}</h2>
        <div className="stat-cards">
          <div className="stat-card">
            <div>{t('result.beforeSpeedups')}</div>
            <div className="value">{formatDuration(plan.totalSecRaw, t)}</div>
          </div>
          <div className="stat-card">
            <div>{t('result.afterSpeedups')}</div>
            <div className="value">{formatDuration(plan.totalSecWithSpeedups, t)}</div>
          </div>
          <div className="stat-card">
            <div>{t('result.totalPower')}</div>
            <div className="value">+{formatNumber(plan.totalPower)}</div>
          </div>
        </div>
      </section>
      <section>
        <h2>{t('result.totalCost')}</h2>
        <div className="stat-cards">
          {RESOURCES.map((r) => (
            <div className="stat-card" key={r}>
              <div>{t(`res.${r}`)}</div>
              <div className="value">{formatNumber(plan.totalCost[r])}</div>
            </div>
          ))}
        </div>
      </section>
      {Object.keys(usedSummary).length > 0 && (
        <section>
          <h2>{t('result.speedupsUsed')}</h2>
          <ul>{Object.entries(usedSummary).map(([k, v]) => <li key={k}>{k} × {v}</li>)}</ul>
        </section>
      )}
      <section>
        <h2>{t('result.timeline')}</h2>
        <table className="timeline">
          <thead>
            <tr><th>#</th><th /><th>{t('result.start')}</th><th>{t('result.duration')}</th><th /></tr>
          </thead>
          <tbody>
            {plan.tasks.map((task, i) => (
              <tr key={task.key}>
                <td>{i + 1}</td>
                <td>
                  <img src={iconUrl(task.kind, task.node.id)} alt="" />
                  {name(task.node.id)} {t('level')}{task.node.level}
                </td>
                <td>{formatDuration(task.startSec, t)}</td>
                <td>{formatDuration(task.durationSec, t)}</td>
                <td>{queueName(task.queue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: 수동 스모크 — 엔드투엔드**

dev 서버에서: 신규 상태 + 목표 "시청 8" → 결과 탭에 타임라인/총시간 표시. 가속 아이템 입력 후 "가속 후" 시간 감소 확인. 시청 25로도 계산이 즉시(1초 미만) 끝나는지 확인.

- [ ] **Step 4: 전체 검증**

Run: `cd web && npx tsc --noEmit && npm test && npm run build`
Expected: 모두 통과.
Run: `cd scripts && ..\.venv\Scripts\python validate_data.py && ..\.venv\Scripts\python -m pytest tests/ -v`
Expected: OK + 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: UI — 결과 탭, 엔진 연결 완성"
```

---

### Task 15: 마무리 — README + 최종 검증

**Files:**
- Create: `README.md`
- Delete: `main.py` (PyCharm 템플릿 잔재)

- [ ] **Step 1: README 작성**

내용: 프로젝트 소개(한국어), 스크린샷 자리, 실행법(`cd web && npm install && npm run dev`), 데이터 재수집법(`cd scripts && python scrape_wiki.py`), 검증(`python validate_data.py`, `npm test`), 데이터 출처(riseofkingdoms.fandom.com, CC-BY-SA) 및 아이콘 저작권 고지(Lilith Games 자산, 팬 프로젝트 비상업 사용), 알려진 한계(자원 수급 미모델링, 버프 통합 입력, 건물 1인스턴스 모델).

- [ ] **Step 2: main.py 삭제 + 최종 전체 검증**

```bash
git rm main.py
cd web && npx tsc --noEmit && npm test && npm run build
cd ../scripts && ..\.venv\Scripts\python -m pytest tests/ -v && ..\.venv\Scripts\python validate_data.py
```
Expected: 전부 통과.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README와 프로젝트 마무리"
```
