# Test input — reviewer

## Assumed upstream

- `.harness/domain.md` · `architecture.yaml` · `plan.md` 전부 읽음 (Tier 1 + Tier 2 + Tier 3 전 접근).
- state.yaml.F-003: gate_0~4 pass · gate_5 대기 · evidence 3 건 (`test: 19 specs green`, `coverage: 82%`, `smoke: space→fall ok`).
- PR diff: src/ui/timer.tsx · src/domain/session.ts · tests/ui/timer.spec.tsx · CHANGELOG.md (F-003 entry) · README.md (F-003 quickstart 섹션).

## Task

F-003 이 `--complete` 가능한지 판정하는 리뷰. BR-004 Iron Law (gate_5=pass + evidence ≥ 1) · 10/10 drift 청결 여부 · scope creep · Iron Law evidence 정합성 (원문 vs 요약) 감사. 결과는 **prose 형태로 orchestrator 에게 반환** — reviewer 는 파일을 직접 쓰지 않음 (CQS · BR-012). 확인된 finding 은 `## Findings` 섹션 구조로, 최종 판정은 `## Verdict` 로 (APPROVE · BLOCK · REQUEST_CHANGES).

## Constraints

- read-only · CQS 엄수: Edit/Write 도구 사용 금지
- mtime 불변 보장 (레포 어떤 파일도 수정 X)
- 자동 수정 제안 금지 (`# TODO: fix this` 같은 직접 편집 형 제안)
- 발견을 보고만 하고, 수정은 software-engineer 또는 사용자 결정
