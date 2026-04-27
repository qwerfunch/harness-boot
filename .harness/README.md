# `.harness/` — harness-boot 자체 도그푸드 (DEV ONLY)

이 디렉터리는 **harness-boot 플러그인 개발자가 자기 자신을 관측 + 운영**하기 위한 내부 상태입니다. **사용자 프로젝트의 스펙이 아닙니다.**

## 사용자 안내

- **사용자 프로젝트의 `.harness/`**: `/harness-boot:init` 으로 **사용자 자신의 cwd** 에 생성되는 것. 이 파일이 아님.
- **이 `.harness/`**: harness-boot 리포지터리 루트의 dev-only 운영 공간. 플러그인 설치 시 사용자 기기에 함께 복사되지만 `/harness-boot:*` 명령은 이 경로를 **절대 참조하지 않음** (항상 `$(pwd)/.harness` 만 본다).

## SSoT

- `spec.yaml` = `docs/samples/harness-boot-self/spec.yaml` 의 **복사본**. 원본은 후자.
- 편집은 양쪽 동시에 (canonical 먼저, `.harness/spec.yaml` 에 cp). `scripts/self_check.sh` 의 `diff -q` 가 동기성 강제.
- `state.yaml` = work.py 가 갱신. **수동 편집 금지**. v0.3.x 시기 24 features 는 frozen, F-025 부터 Phase 2 활성 사이클.
- `events.log` · `harness.yaml` · `domain.md` · `architecture.yaml` · `chapters/` · `_workspace/` = gitignored (derived · ephemeral · ceremony).

## Phase 2 active (2026-04-27 ~)

이 레포의 **모든 신규 피처는 `python3 scripts/work.py` 사이클을 거친다** (cosmic-suika 와 동일 규약).
`project.mode: prototype` — Iron Law D 는 evidence ≥ 1 + gate_5 pass.

```
python3 scripts/work.py F-N --harness-dir .harness                       # activate
python3 scripts/work.py F-N --harness-dir .harness --run-gate gate_0     # tests
python3 scripts/work.py F-N --harness-dir .harness --run-gate gate_5     # smoke (= self_check.sh via scripts/smoke.sh shim)
python3 scripts/work.py F-N --harness-dir .harness --evidence "..."
python3 scripts/work.py F-N --harness-dir .harness --complete
```

슬래시 명령(`/harness-boot:work`)은 **이 레포에서 live-edit 불가** (설치본이 우선) — 항상 `python3 scripts/work.py` 직접 호출. 자세한 정책은 루트 `CLAUDE.md` §7.

## 검증

```
bash scripts/self_check.sh
```

5 단계 (diff → validate_spec → sync --dry-run → check → commands/*.md 규약 grep) 통과 시 exit 0.
`scripts/smoke.sh` 는 이 파일의 thin wrapper — gate_5 auto-detect 가 잡는다.
