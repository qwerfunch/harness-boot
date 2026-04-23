---
description: 현재 하네스 상태 요약 — 세션 · 피처 카운트 · drift · 마지막 sync · active 피처. 읽기 전용 (CQS).
allowed-tools: [Read, Bash]
argument-hint: "[--feature F-ID] [--json]"
---

# /harness:status — 상태 조회 (F-005)

**CQS 불변조건**: 파일 수정 없음. mtime 포함 어떤 부작용도 없어야 함 (테스트로 검증됨).

## Preamble (출력 맨 앞 3 줄)

```
📋 /harness:status · <scope=full|feature:F-XXX> · <근거 5~10 단어>
NO skip: state.yaml + harness.yaml + events.log 세 소스 모두 읽기
NO shortcut: CQS — 진단 중 파일 mtime 변경 금지 (BR-012)
```

**1 줄**: 이모지 · 명령 · scope · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: 소스 부분 읽기 · CQS 위반을 명시 거부.

예: `📋 /harness:status · full · 세션 요약 + 전체 피처 카운트`.

## 실행

Claude 는 `scripts/status.py` 호출:

```bash
python3 "$PLUGIN_ROOT/scripts/status.py" --harness-dir "$(pwd)/.harness" --json
```

옵션:
- `--feature F-NNN` — 특정 피처만 요약.
- `--json` — 기계 파싱용.

## 출력 섹션 (human 모드)

1. **Session** — `started_at`, `last_command`, `last_gate_passed`, `active_feature_id`
2. **Features (N)** — status 별 카운트 (planned / in_progress / blocked / done / archived)
3. **Drift status** — `harness.yaml.generation.drift_status` 그대로 (clean / spec_changed / derived_edited / include_changed / generated_edited)
4. **Last sync** — events.log 에서 마지막 `sync_completed` 뽑아서 ts · spec_hash · plugin_version
5. **Active feature** — 있을 때만. gates_passed/failed, evidence 개수.

## 전형 사용

```
/harness:status
→ 한눈에 "지금 뭐 진행 중이고 최근 sync 언제였나" 파악.

/harness:status --feature F-004
→ F-004 만 집중 조회.
```

## 참조

- `scripts/status.py` · `scripts/state.py` · `scripts/events.py`.
- BR-012 (CQS 원칙): 진단 명령은 파일 수정 금지.
