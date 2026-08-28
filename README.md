# RoK Calculator

라이즈 오브 킹덤즈(Rise of Kingdoms)의 건물·연구 업그레이드 계획을 세우기 위한 계산기입니다. 목표로 삼은 건물/연구 레벨을 입력하면 선행 조건을 역산해 전체 작업 목록과 소요 시간, 자원, 가속 아이템 배분안을 계산해 줍니다.

데이터는 [Rise of Kingdoms Wiki](https://riseofkingdoms.fandom.com)를 스크래핑해 만들었고, 계산 엔진과 UI는 이 저장소 안에서 직접 구현했습니다.

## 구성

- `scripts/` — 위키 스크래퍼(`scrape_wiki.py`)와 데이터 검증 스크립트(`validate_data.py`), pytest 테스트 33개
- `web/` — React 기반 SPA. 내 도시 / 목표 설정 / 결과 3개 탭으로 구성, vitest 테스트 15개

## 실행 방법

```bash
cd web
npm install
npm run dev
```

브라우저에서 안내된 주소(기본 `http://localhost:5173`)로 접속하면 됩니다.

## 데이터 재수집

위키 원문이 갱신되었을 때 데이터를 다시 긁어오려면:

```bash
cd scripts
pip install -r requirements.txt
python scrape_wiki.py
```

Windows에서 저장소에 포함된 가상환경을 쓰는 경우:

```bash
cd scripts
..\.venv\Scripts\python scrape_wiki.py
```

## 검증

```bash
# 데이터 정합성 검증
cd scripts
python validate_data.py        # Windows: ..\.venv\Scripts\python validate_data.py

# 스크래퍼/검증 스크립트 단위 테스트
pytest tests/                  # Windows: ..\.venv\Scripts\python -m pytest tests/

# 프런트엔드 테스트
cd web
npm test
```

## 데이터 출처 및 저작권

- 게임 데이터(건물/연구 스탯, 선행 조건, 소요 시간 등)는 [riseofkingdoms.fandom.com](https://riseofkingdoms.fandom.com)에서 가져왔으며, 해당 위키의 콘텐츠는 [CC BY-SA](https://www.fandom.com/licensing) 라이선스를 따릅니다.
- 건물/연구 아이콘은 Lilith Games의 게임 자산입니다. 이 프로젝트는 원 저작권자와 무관한 비공식 팬 프로젝트이며, 아이콘은 비상업적 목적으로만 사용합니다.
- Rise of Kingdoms는 Lilith Games의 상표입니다.

## 알려진 한계

- 위키에 값이 "알 수 없음"으로 표기된 항목 19건은 0으로 수집되며, `validate_data.py` 실행 시 경고로 표시됩니다. 필요 시 `overrides.json`으로 값을 보정할 수 있습니다.
- 시청(City Hall) 24레벨의 전투력 수치는 위키 원문의 오타로 판단되어 `overrides.json`을 통해 보간한 값을 사용합니다.
- 자원 수급(생산량)은 모델링하지 않으며, 목표 달성에 필요한 자원 총량만 계산합니다.
- 버프는 세부 항목별이 아니라 통합 퍼센트 입력 2개(예: 건설/연구 가속 버프)로만 반영됩니다.
- 건물은 종류별로 1개 인스턴스만 존재한다고 가정합니다(같은 건물을 여러 채 보유하는 경우는 다루지 않습니다).
- 한국어 이름은 건물 100%, 연구 51/71개까지 매핑되어 있으며, 누락된 연구명은 영문 원문으로 표시됩니다.
- 문명(civilization) 고유 병종 특화 테크 16개는 사실상 일반 테크의 별칭이라 계산상 동일 항목으로 병합되어 있습니다.
- 가속 아이템은 작업 남은 시간을 초과하는 크기를 사용하지 않도록(낭비 방지) 배분합니다. 이 때문에 보유한 가속 아이템이 대형뿐인 경우 일부 작업에는 가속이 적용되지 않을 수 있습니다.
