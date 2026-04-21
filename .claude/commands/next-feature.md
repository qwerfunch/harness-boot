---
description: spec.yaml 에서 다음 작업 피처를 규약에 따라 pick 한다 (Stage 0 부트스트랩용)
argument-hint: "[--dry-run]"
allowed-tools: Read, Grep, Glob, Bash
---

# /next-feature — 다음 피처 pick (Stage 0)

당신은 harness-boot Stage 0 부트스트랩의 **피처 picker** 다.  자동화된
`/harness:work` (F-010) 가 도달하기 전까지 사람이 "다음에 뭘 할까" 를 고를 때
사용하는 슬래시 명령이다.

## 입력

- **필수** — 리포지토리 루트의 `spec.yaml` (SSoT)
- **선택** — `.harness/state.yaml` (이전 세션 상태, 있을 수 있음)
- **선택** — `.harness/events.log` (append-only 이벤트 로그, F-013 이후)
- **선택** — 인수 `--dry-run` (선택만, 상태 전이 · 이벤트 기록 생략)

## 선택 규칙 (절대 바꾸지 말 것)

순서대로 필터 · 정렬 후 **최상위 1 개** 만 고른다:

1. `features[].status == "planned"` 인 피처만 후보.
2. 후보 중 `depends_on` 의 모든 참조 피처가 `features[].status == "done"` 인
   것만 통과.  단 `depends_on` 이 빈 배열이면 자동 통과.
3. 통과한 후보를 `priority` 오름차순으로 정렬 (작을수록 앞).
4. 동률은 `id` 오름차순(`F-001` < `F-002` < ... < `F-018`).
5. 최상위 1 개 = **선택 결과**.

후보가 비어 있으면 "선택 없음 — 모든 가능 피처가 완료되었거나 의존성이
막혀 있다" 고 보고하고 종료.

## 출력 형식 (stdout)

선택된 피처를 한국어로 간결히 보고한다:

```
선택: F-NNN — <title>
우선순위: N  (후보 수: M)
test_strategy: <tdd | lean-tdd | integration | state-verification>
acceptance_criteria 요약:
  - <첫 2~3 줄만 요약, 원문 그대로>
modules: [<쉼표 목록>]
depends_on 완료 여부: ok  (또는 차단됨: F-XXX, F-YYY)

다음 행동 (번호 선택):
  1) 승인 — 이 피처 착수
  2) 건너뛰기 — 다음 후보 보기
  3) 취소 — 현재 세션에 다른 작업
```

`--dry-run` 이 아닌 경우, 사용자 승인(1) 을 받으면:
- (F-013 도달 후) `.harness/events.log` 에 `feature_pick` 이벤트 append
- `spec.yaml` 의 해당 피처 `status` 를 `in_progress` 로 갱신
- `orchestrator` 서브에이전트 호출을 제안

`--dry-run` 이면 위 부수 효과 전부 생략.

## 금지 사항

- **규칙 변경** — priority · id 외 기준(예: "재미있어 보이는 것") 으로 고르지 말 것.
  이 규약은 `spec.yaml` 자체 변경으로만 바뀐다(ADR 필요).
- **복수 선택** — "이 두 개를 함께 하자" 는 사용자의 명시 지시 없이는 금지.
  한 번에 한 피처 (CLAUDE.md 세션 에티켓).
- **덮어쓰기** — `spec.yaml` 외 파일을 이 명령이 수정하게 하지 말 것.
  (이벤트 로그 append 는 쓰기가 아닌 추가이므로 허용.)
- **상태 역행** — `done → in_progress` 되돌리기는 이 명령의 책임이 아니다.
  ADR 기록 후 사람이 수동 편집.

## 세션 에티켓 (BR-010 관련)

- 해소되지 않은 가정이 생기면 **한 번에 한 질문** 만 묻고 번호 선택지로
  제시하라.
- 피처 선택 이후 구현 위임은 `orchestrator` 에이전트에게 넘기고, 이 명령
  자체에서 구현으로 확장하지 말 것.

## 참고

- `CLAUDE.md` "Stage 0 부트스트랩 규약 — 다음 피처 pick"
- `spec.yaml.deliverable.smoke_scenarios[SS-005]` — 본 명령의 성공 조건 정의
- BR-001 (덮어쓰기 금지) · BR-008 (이벤트 로그)
