# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

라이즈 오브 킹덤즈(RoK) 건물/연구 업그레이드 계획 계산기. 위키 스크래핑 데이터(Python) + 계산 엔진/SPA(React+TypeScript)로 구성된 비공식 팬 프로젝트. 문서·커밋·코드 주석은 주로 한국어를 사용한다. 저장소 규칙 상세는 `AGENTS.md` 참고.

## 명령어

### 프런트엔드 (`web/`에서 실행)

```bash
npm run dev        # Vite 개발 서버 (기본 http://localhost:5173)
npm run build      # 엄격 TS 타입체크(tsc -b) + 프로덕션 빌드 → web/dist/
npm run lint       # Oxlint
npm test           # Vitest 전체 1회 실행 (vitest run)
npm test -- src/engine/__tests__/scheduler.test.ts   # 단일 테스트 파일
npm run preview    # 빌드 결과 로컬 서빙
```

### 데이터 도구 (`scripts/`에서 실행)

Windows에서는 저장소 루트의 가상환경을 사용: `..\.venv\Scripts\python`

```bash
..\.venv\Scripts\python -m pytest tests/                          # 스크래퍼 테스트 전체
..\.venv\Scripts\python -m pytest tests/test_parse_tech.py -k 이름  # 단일 테스트
..\.venv\Scripts\python validate_data.py                          # 데이터 정합성 검증 (CI 게이트, 위반 시 exit 1)
..\.venv\Scripts\python scrape_wiki.py                            # 위키 재수집 (의도적 데이터 갱신 시에만)
```

스크래퍼는 `.cache/`가 있으면 네트워크 요청 없이 재생성한다. `--skip-icons`로 아이콘 다운로드를 생략할 수 있다.

## 아키텍처

### 데이터 파이프라인 (Python → JSON)

`scripts/scrape_wiki.py`가 riseofkingdoms.fandom.com을 스크래핑해 `web/src/data/{buildings,research}.json`과 `web/public/icons/`를 생성한다. 프런트엔드는 이 JSON을 빌드 시점에 import할 뿐, 런타임 네트워크 요청이 없다.

- `scripts/rok_wiki/` — 파싱 패키지: `api.py`(위키 API 호출), `parse_buildings.py`, `parse_tech.py`, `icons.py`, `textutil.py`(slugify)
- `web/src/data/overrides.json` — 위키 원문 오류(오타, "알 수 없음" 값) 보정 패치. 형식: `{"buildings": {id: {레벨문자열: {필드: 값}}}}`. 스크래핑 시 적용됨
- 문명 고유 병종 테크는 위키에서 공용 테크로 리다이렉트되며(`#REDIRECT`), 스크래퍼가 별칭으로 병합한다
- `validate_data.py` — requirement 참조 무결성, 순환 없음(Kahn), 레벨 연속성, 음수 값, 아이콘 존재 5가지 검사. CI에서 실행됨
- 건물/연구 데이터 모델을 바꾸면 Python과 TypeScript 양쪽 테스트를 모두 돌려야 한다

### 계산 엔진 (`web/src/engine/` — 결정적, UI 독립)

`plan.ts`의 `makePlan`이 전체 파이프라인을 조율한다:

1. `graph.ts` `buildIndex` — 카탈로그 인덱스, `TaskNode` 생성. 노드 키 형식은 `${kind}:${id}:${level}`
2. `closure.ts` `requiredNodes` — 목표 달성에 필요한 미완료 노드의 전이 폐쇄(현재 보유 레벨 차감)
3. `scheduler.ts` — `critical.ts`의 최장 경로 가중치 순으로 우선순위 스케줄링. 건설 큐 1~2개(secondBuilder), 건설/연구 가속 버프 %, `speedBonuses.ts`의 연구 완료에 따른 속도 테크 보너스 반영
4. `speedups.ts` `allocateSpeedups` — 가속 아이템 배분. 작업 남은 시간을 초과하는 아이템은 쓰지 않음(낭비 방지)

`PlanMode`는 `fastest`/`efficient` 두 가지. efficient 모드는 속도 테크를 먼저 올리는 최적화 목표를 추가로 탐색한다.

### 상태와 UI (`web/src/state/`, `web/src/ui/`)

- `state/userState.ts` — useReducer 기반 사용자 상태, localStorage 키 `rok-calculator-state-v1`에 자동 저장
- `state/persistence.ts` — 상태 정규화/마이그레이션, 백업 JSON 내보내기/가져오기 (`BackupFile` version 필드)
- `ui/App.tsx` — 내 도시(`CityTab`) / 목표(`GoalsTab`) / 결과(`ResultTab`) 3탭 구조
- `i18n/` — UI 문자열은 `ui.en.ts`/`ui.ko.ts`, 게임 항목 이름은 `data/names.{en,ko}.json`. 한국어 연구명이 없으면 영문 원문으로 표시

## 컨벤션

- TypeScript: 2칸 들여쓰기, 작은따옴표. 컴포넌트/타입은 PascalCase, 함수/변수는 camelCase
- Python: PEP 8, 4칸 들여쓰기, snake_case
- 카탈로그 id와 아이콘 파일명은 lowercase snake_case (예: `city_hall.png`)
- 테스트는 도메인 옆 `__tests__/*.test.ts`(Vitest), `scripts/tests/test_*.py`(pytest)
- 커밋은 Conventional Commit 접두사(`feat:`, `fix:`, `docs:`) + 한국어 또는 영어 명령형 요약
- 설계 노트와 구현 계획은 `docs/superpowers/{specs,plans}/`에 저장

## 배포

`master` 푸시 → `.github/workflows/deploy.yml`이 린트·테스트·빌드 검증 후 GitHub Pages 자동 배포. Vite는 상대 base 경로로 빌드되므로 프로젝트 페이지 하위 경로에서도 동작한다. 공개 주소: https://ksj0104.github.io/RoK_Calculator/
