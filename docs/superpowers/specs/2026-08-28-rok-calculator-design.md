# RoK 최적화 계산기 — 설계 문서

날짜: 2026-08-28
상태: 승인됨

## 목적

Rise of Kingdoms의 건물·연구 데이터를 기반으로, 사용자가 지정한 목표(예: 시청 25, T4 병력 해금)에
도달하는 **최소 시간 루트**를 계산하고, 보유한 **가속 아이템을 가장 효율적으로 배분**하는 방법을
제시하는 웹 계산기.

- 신규 유저(디폴트 상태)와 기존 유저(현재 건물/연구 레벨, 가속 아이템 보유량 입력) 모두 지원
- 서버 없는 정적 웹사이트로 무료 배포 (GitHub Pages / Vercel)

## 확정된 요구사항

| 항목 | 결정 |
|---|---|
| 최적화 목표 | 특정 목표 도달 시간 최소화 + 가속 아이템 효율 극대화 |
| 데이터 범위 | 전체 건물 + 경제/군사 연구 트리 (병력 훈련·사령관·장비는 범위 외) |
| 기술 스택 | React + TypeScript + Vite SPA, 서버리스 |
| 아이콘 | rok.fandom.com 위키에서 수집 |
| UI 언어 | 한국어 + 영어 (i18n) |
| 엔진 방식 | 의존성 그래프(DAG) + 이산 사건 시뮬레이션 + 크리티컬 패스 스케줄링 |

## 전체 구조

```
RoK_Calculator/
├── scripts/              # 데이터 수집 (Python, 1회성 도구)
│   ├── scrape_wiki.py    # rok.fandom.com에서 건물/연구 데이터 + 아이콘 수집
│   └── validate_data.py  # 데이터 정합성 검증
├── web/                  # React SPA (TypeScript + Vite)
│   ├── public/icons/     # 수집한 건물/연구 아이콘 (buildings/, research/)
│   └── src/
│       ├── data/         # buildings.json, research.json, names.ko.json 등
│       ├── engine/       # 순수 TS 최적화 엔진 (UI 무관, 단위 테스트 대상)
│       ├── state/        # 사용자 상태 + localStorage 영속화
│       └── ui/           # 화면 컴포넌트
└── docs/superpowers/specs/  # 설계 문서
```

## 데이터 모델

### 건물 (`buildings.json`)

```jsonc
{
  "id": "city_hall",
  "category": "economic | military | decorative",
  "maxLevel": 25,
  "levels": [
    {
      "level": 2,
      "requirements": [{ "type": "building", "id": "wall", "level": 1 }],
      "cost": { "food": 0, "wood": 200, "stone": 0, "gold": 0 },
      "timeSec": 8,
      "power": 15
    }
  ]
}
```

### 연구 (`research.json`)

```jsonc
{
  "id": "masonry",
  "tree": "economic | military",
  "maxLevel": 10,
  "levels": [
    {
      "level": 1,
      "requirements": [
        { "type": "building", "id": "academy", "level": 5 },
        { "type": "research", "id": "engineering", "level": 3 }
      ],
      "cost": { "food": 1200, "wood": 1200, "stone": 0, "gold": 0 },
      "timeSec": 600,
      "power": 20
    }
  ]
}
```

### 이름/i18n (`names.ko.json`, `names.en.json`)

`id → 표시 이름` 매핑. 영어는 위키에서, 한국어는 수동 매핑 파일로 관리.

### 사용자 상태 (localStorage)

```jsonc
{
  "buildings": { "city_hall": 5, "farm_1": 4 },   // id → 현재 레벨 (건물 슬롯 복수 지원)
  "research": { "masonry": 2 },
  "speedups": {
    "universal": { "1m": 0, "5m": 10, "1h": 3, "3h": 0, "8h": 1, "24h": 0, "3d": 0, "7d": 0, "30d": 0 },
    "building": { /* 동일 구조 */ },
    "research": { /* 동일 구조 */ }
  },
  "buffs": { "buildingSpeedPct": 0, "researchSpeedPct": 0 },  // 통합 버프 입력
  "secondBuilder": true
}
```

버프(문명, VIP, 동맹 기술 등)는 1차 버전에서 통합 % 필드 2개로 단순화한다.

## 최적화 엔진

순수 TypeScript 모듈. 입력: (게임 데이터, 사용자 상태, 목표 집합) → 출력: 계획(Plan).

1. **목표 해석**: 목표를 `(id, level)` 노드 집합으로 변환. 역방향 BFS로 모든 선행 조건을
   전이적으로 수집하고, 이미 달성한 노드는 제외 → 남은 작업 집합.
2. **스케줄링**: 이산 사건 시뮬레이션.
   - 리소스: 건설 큐(2번째 건설자 옵션에 따라 1~2개), 연구 큐 1개.
   - 우선순위: 각 노드의 "목표까지 남은 최장 경로 길이(critical path weight, 시간 기준)"가
     큰 작업부터 큐에 할당.
   - 버프 %는 작업 시간에 `timeSec / (1 + pct/100)`로 반영.
3. **가속 배분**: 완성된 스케줄에서 크리티컬 패스 상의 작업에 가속을 배분.
   - 타입 일치 가속(건설/연구) 우선, 범용은 나중에.
   - 큰 단위부터 그리디로 채우되 초과 가속(낭비) 최소화.
   - 가속 적용 후 크리티컬 패스가 바뀌면 재계산(수렴할 때까지, 상한 횟수 제한).
4. **출력(Plan)**:
   - 작업 타임라인: `{ node, queue, startSec, endSec, appliedSpeedups }` 목록
   - 총 소요 시간 (가속 전/후), 자원 총 요구량, 가속 사용 내역/잔여량

자원(식량/목재 등) 수급은 1차 버전에서 제약으로 두지 않는다 — 총 요구량만 보여준다.
(자원 생산/채집 모델링은 범위 외. 추후 확장 지점으로 명시.)

## UI — 3개 탭

1. **내 도시**: 건물 그리드(아이콘 + 레벨 선택 드롭다운/스테퍼), 연구 트리 뷰(트리 레이아웃,
   아이콘 + 현재 레벨), 가속 아이템/버프/2번째 건설자 입력 패널. 디폴트 = 신규 계정 상태.
2. **목표 설정**: 프리셋 버튼(시청 목표별, T4/T5 해금 등) + 개별 건물/연구 목표 직접 선택.
3. **결과**: 순서 타임라인(단계별로 무엇을 언제), 총 소요 시간(가속 전/후), 자원 총량,
   가속 사용 내역, 단계별 체크리스트.

공통: 한/영 전환 토글, localStorage 자동 저장, 반응형(모바일 사용 고려).

## 데이터 수집·검증 (Python)

- `scrape_wiki.py`: rok.fandom.com의 건물/연구 페이지를 파싱해 JSON 생성, 아이콘 다운로드.
  요청 간 딜레이를 두고 정중하게 수집. 결과는 저장소에 커밋(재수집은 수동).
- `validate_data.py`: 선행조건 대상 존재 여부, DAG 순환 없음, 레벨별 시간/비용 단조성,
  아이콘 파일 존재 여부 검증. 실패 시 비정상 종료(CI 게이트 역할).
- 위키 데이터 오류 가능성이 있으므로, 수동 보정은 `data/overrides.json`으로 관리하고
  스크레이퍼가 병합한다 (재수집해도 보정이 유지되도록).

## 테스트

- **엔진 단위 테스트** (Vitest): 소규모 가상 데이터로 —
  선행조건 위반 없는 순서, 크리티컬 패스 계산 정확성, 가속 배분 낭비 최소화,
  이미 달성한 노드 제외, 2번째 건설자 유무에 따른 시간 차이.
- **데이터 검증**: `validate_data.py`가 실제 데이터에 대한 회귀 게이트.
- UI는 1차 버전에서 수동 확인(스모크) 수준.

## 범위 외 (추후 확장)

- 자원 생산/채집 모델링, 병력 훈련, 사령관/장비, KvK 이벤트 최적화
- 사용자 계정/서버 저장, 계획 공유 URL
