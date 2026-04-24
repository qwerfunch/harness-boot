# Test input — orchestrator

## Assumed upstream

- `.harness/spec.yaml` — F-003 skeleton 피처 (ui_surface.present=true, has_audio=true, performance_budget 선언).
- `.harness/domain.md` · `.harness/architecture.yaml` 이미 파생 완료.
- state.yaml: F-003 = planned · active_feature_id: null

## Orchestrator prompt

사용자: `/harness:work F-003 activate` — F-003 의 TDD 사이클 시작. orchestrator 는 work.activate 후 자동 발화된 kickoff ceremony 를 완결할 의무가 있음 (`_workspace/kickoff/F-003.md` 의 각 agent heading 채우기).

## Task

F-003 의 orchestration 응답 — 사용자 눈앞에 표시될 prose 보고를 작성. state 전이 요약 + kickoff ceremony 진행 · 9 agent 소환 결과 · BLOCK 건 · 다음 단계 제안. 이 응답은 orchestrator 의 "산출물" — 파일 write 는 안 하지만 사용자에게 보이는 구조화된 prose 가 곧 기록. BR-004 Iron Law 준수 (complete 거부 근거 언급 필수).

## Constraints

- 9 agent (ui_surface.present + feature_completion shape) 전부 언급
- BLOCK 건이 있으면 구현 착수 전 반드시 해소 단계 명시
- Iron Law 인용 (gate_5=pass + evidence ≥ 1)
- 사용자 다음 명령 제안으로 마무리 (`/harness:spec` · `/harness:sync` · TDD 착수 등)
