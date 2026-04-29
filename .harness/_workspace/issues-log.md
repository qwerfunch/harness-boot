# harness-boot ISSUES-LOG — harness-boot self (Phase 2 dogfood)

본 레포의 자체 도그푸드 사이클 (F-025 ~ F-033) 동안 발견한 harness-boot 자체의 마찰 / 갭 / 디자인 question. F-027 컨벤션의 첫 자체 적용 (v0.10.7 audit pass).

각 entry: `Source / Category / Severity / What happened / Suggested fix`. cosmic-suika 의 `I-NNN` 패턴을 따르되 self 접두사는 안 붙임 (이 파일이 본 레포 컨텍스트라 자명).

---

## 2026-04-27T01:53Z — gate_5 가 self_check.sh 를 자동 감지 못함

- **Source**: F-025 활성화 + gate_5 자동 감지
- **Category**: ergonomics · gate-detect
- **Severity**: annoying
- **What happened**: `python3 scripts/work.py F-025 --run-gate gate_5 --project-root .` 호출 시 "no runtime smoke detected (scripts/smoke.sh · tests/smoke/ · Makefile smoke · package.json scripts.smoke 모두 부재)" 메시지로 skip. 본 레포의 smoke 는 `scripts/self_check.sh` 인데 detect 우선순위에 들어있지 않음.
- **Suggested fix**: ✅ **FIXED in F-026 (v0.10.4)** — `scripts/smoke.sh` shim 신설 → self_check.sh 위임. detect 가 자동으로 잡음.

## 2026-04-27T01:53Z — gate_0 (pytest) 가 design/oss-refs/ 까지 수집해서 collection error

- **Source**: F-026 gate_0 시도
- **Category**: bug · gate-detect · ergonomics
- **Severity**: annoying
- **What happened**: gate_0 이 베어 `python3 -m pytest` (positional 인자 없음) 호출. pytest 가 cwd 부터 recursive 수집 → `design/oss-refs/` (gitignored 외부 OSS 참조본) 의 테스트들까지 포함, 의존성 부재로 238 collection error 후 exit 2.
- **Suggested fix**: ✅ **FIXED in F-026 (v0.10.4)** — `pytest.ini` 추가 (`testpaths = tests/unit`). 베어 pytest 가 scope 고정. 다만 root cause 는 `scripts/gate/runner.py::detect_gate_0_command` 가 `tests/` positional 안 붙이고 베어 pytest 만 반환하는 것 — 향후 검토 후보.

## 2026-04-27T01:54Z — `hooks/session-bootstrap.sh` 의 dead reference (/harness:status)

- **Source**: F-026 stale doc audit
- **Category**: dead-reference
- **Severity**: blocker (사용자 visible)
- **What happened**: 모든 사용자 워크스페이스의 SessionStart 마다 "try /harness:status" 안내 출력. 단 v0.9.0 통합으로 `/harness:status` 명령은 부재. 사용자가 따라 입력하면 "no such command".
- **Suggested fix**: ✅ **FIXED in F-026 (v0.10.4)** — `/harness:status` → `/harness-boot:work` (no-args 대시보드, v0.9.2 entry point).

## 2026-04-27T02:18Z — `git tag` 가 main push 권한 hook 에 의해 차단됨

- **Source**: F-026 v0.10.4 release attempt
- **Category**: dev-tooling (sandbox)
- **Severity**: annoying (사용자 명시 승인 후에도 차단)
- **What happened**: `git tag -a v0.10.4 -m "..."` 호출이 sandbox hook 에 의해 거부됨. Reason: "Direct push to main bypasses pull request review". 단 git tag 는 push 가 아니라 local action. Hook 의 매처가 명령 prefix `git tag` 와 `git push` 를 동일 위험으로 분류한 듯.
- **Workaround**: 사용자에게 `!`-prefix one-liner 핸드오프. 다음 v0.10.5/0.10.6/0.10.7 에서는 hook 가 막지 않음 (관찰 기반 가설: 하루 내에 같은 종류 명령 재시도 시 cache 작동?).
- **Suggested fix**: 본질은 사용자 환경의 sandbox 정책 — harness-boot 차원에서는 `docs/release/*.md` 에 hook 차단 시 `!`-prefix fallback 안내 한 줄 정도. (v0.10.7 에선 이미 사용자가 인지하는 패턴.)

## 2026-04-27T03:30Z — `--kind trivial` 같은 새 vocabulary 가 free-string 이라 검증 X

- **Source**: F-032 (cosmic-suika I-006) 진행 중 발견
- **Category**: design-question
- **Severity**: trivial
- **What happened**: `--kind` 가 free string. 컨벤션 외 값 (예: `--kind tirvial` 오타) 도 그대로 통과. 의도된 자유도이지만 컨벤션 enforcement 와 trade-off.
- **Suggested fix**: 향후 검토 — opt-in `--strict-kind` flag 또는 work.md 의 taxonomy 에 명시된 값만 받는 옵션. 지금은 free-string 유지 (cosmic-suika 가 이미 hack 으로 다른 kind 쓸 수 있어서 깨뜨릴 위험).

## 2026-04-27T04:45Z — F-028 prompt log hook 의 첫 entry 가 빈 prompt + 빈 session_id

- **Source**: F-033 audit 발견
- **Category**: bug (잠재) · production-validation-needed
- **Severity**: annoying
- **What happened**: `.harness/_workspace/prompts/2026-04.jsonl` 첫 줄 = `{"ts": "2026-04-27T04:45:10Z", "session_id": "", "prompt": ""}`. 두 가능성 — (a) F-028 첫 smoke test (`echo "" | bash hooks/prompt-log.sh`) 의 부산물. (b) Claude Code 가 UserPromptSubmit hook fire 했지만 stdin payload 가 비었음. 후자면 production 에서 hook 작동 안 함.
- **Diagnostic**: 만약 (b) 라면 매 prompt 마다 빈 entry 누적되어야. 하지만 한 줄만 → (a) 가능성 높음. 즉 production 에서 hook 자체가 fire 안 함 — Claude Code 가 새 hooks.json 인식 못 함 가능성 (사용자가 `/plugin update harness-boot@harness-boot` 안 함).
- **Suggested fix**: v0.10.7 CHANGELOG 에 "사용자가 `/plugin update` 후 새 prompt log hook 활성화" 명시. 사용자 update 후 다음 세션부터 실측 데이터로 검증. 만약 그 후에도 빈 entry 만 누적된다면 hook 의 stdin 처리 재검토.

## 2026-04-27T04:50Z — `.harness/_workspace/issues-log.md` 자체가 비어있던 도그푸드 모순

- **Source**: F-033 audit
- **Category**: dogfood-violation · meta
- **Severity**: annoying
- **What happened**: F-027 (v0.10.5) 가 issue logging 컨벤션을 만들고 commands/{init,work}.md 에 명시했지만, 본 레포 자체의 `.harness/_workspace/issues-log.md` 는 v0.10.7 audit 시점까지 부재. F-025 ~ F-032 동안 발견한 마찰 (위 6 entry) 들을 안 적었음. "남이 쓸 도구 만들었는데 자기는 안 씀" 의 전형적 모순.
- **Suggested fix**: ✅ **FIXED in F-033 (v0.10.7 audit pass)** — 본 파일이 그 첫 적용. 향후 새 피처 사이클 동안 발견 시 즉시 append.

## 2026-04-27T04:55Z — F-029 새 schema fields 가 work.py 와 wire 안 됨 (의도된 design 인지 모호)

- **Source**: F-033 audit
- **Category**: design-question · documentation
- **Severity**: trivial
- **What happened**: F-029 가 `features[]` 에 `archived_at` · `archive_reason` 등 5 fields 를 schema-only 로 추가. 사용자/audit reader 가 "이게 work.py archive 호출 시 자동 채워지나?" 라고 자연스럽게 기대하지만 그렇지 않음. state.yaml 의 status=archived 가 runtime 책임. spec.yaml 의 field 는 declarative.
- **Suggested fix**: ✅ **FIXED in F-033 (v0.10.7 audit pass)** — `docs/schemas/spec.schema.json` 의 archived_at / archive_reason description 에 "declarative · work.py 자동 채우지 않음" 명시. 향후 같은 질문 차단.

---

## 2026-04-27T05:30Z — pre-commit hook 와 release commit 의 active reset 충돌

- **Source**: F-034 self-install + v0.10.9 release commit
- **Category**: design-question · workflow
- **Severity**: annoying
- **What happened**: F-034 가 work.py 풀 사이클 완료 (--complete) 후 release commit 진입. 단 --complete 가 `session.active_feature_id` 를 None 으로 reset → 새로 install 한 pre-commit hook 가 분기 4 (active 없음 + non-whitelisted staged) 로 reject. release commit 자체는 `--no-verify` 우회 사용했지만 자기 자신을 막는 아이러니.
- **Root cause**: work.py cycle 의 자연스런 순서 (activate → work → evidence → complete → commit) 가 hook 의 enforcement 순서와 충돌. complete 가 commit 보다 먼저면 active 가 reset 됨.
- **Suggested fix (future)**: 두 안 — (A) `release flow` 순서를 권장: activate → work → evidence → **commit → push → tag → complete**. complete 가 마지막. retro 도 commit 후. (B) work.py --complete 에 `--keep-active` flag 추가. 사용자 명시 시 active 유지.
- **현재 워크어라운드**: release commit 은 `git commit --no-verify` 사용 (의도된 우회 — `HARNESS_BYPASS_PRE_COMMIT=1` 와 동등). 단 일관성 위해 다음 v0.10.x 부터 (A) 순서 채택 권장.

## Notes

- 이 파일은 gitignored (.harness/_workspace/) — 외부 공유 시 수동 export.
- cosmic-suika 의 ISSUES-LOG.md 와 양식 통일 권장 (`I-NNN — title` heading).
- 환원 사이클 패턴: 이 파일에서 actionable 한 항목 → harness-boot 메인테이너에게 공유 → 다음 release 의 F-N 으로 트래킹 → ✅ FIXED 표기.

---

## External dogfood return — extract-sensitive-calls (2026-04-29)

신규 외부 사용자가 macOS 시스템 Python 3.9 환경에서 발견한 두 install-time 버그. v0.12.2 (F-081 graceful degradation + F-082 init dep preflight) 으로 동시 fix. v0.10.7 cosmic-suika ISSUES-LOG 환원 패턴의 두 번째 적용.

### 2026-04-29T06:25:00Z — `scripts/work.py` crashes when tomli missing on Python 3.9 ✅ FIXED in v0.12.2 (F-081)

- **Source**: /harness-boot:work
- **Category**: bug
- **Severity**: blocker
- **What happened**: Empty `/harness-boot:work` call (dashboard mode) crashes with `ModuleNotFoundError: No module named 'tomllib'` then `No module named 'tomli'`. Trace points to `scripts/scan/style_fingerprint.py:15-17` — it tries `import tomllib` (Python 3.11+) and falls back to `import tomli`. On macOS system Python 3.9 neither is present, so even the **read-only dashboard** (which doesn't read any TOML file) is unreachable. After `pip install --user tomli` the dashboard works fine.
- **Suggested fix**: in `style_fingerprint.py`, make tomli optional — wrap the import in try/except and degrade gracefully (e.g. set `tomllib = None` and skip TOML-only fingerprinting). Or add `tomli; python_version < "3.11"` to plugin's declared deps and surface a clear "missing optional dep" message at startup instead of a raw traceback. Same gap as the pyyaml issue logged above — plugin assumes deps it doesn't bundle/declare.
- **Resolution**: F-081 (v0.12.2) ships nested try/except so `tomllib = None` when neither package is installed. Each `tomllib.loads` site (3 files: `style_fingerprint.py`, `manifest.py`, `seed_spec.py`) now guards on `if tomllib is None: return False/{}` so the dashboard / kickoff / scan flows stay alive. F-082 adds `/harness-boot:init §0.5` preflight that detects the missing dep at install time and offers `pip install --user` (with explicit user consent + PEP 668 fallback chain).

### 2026-04-29T06:19:40Z — `scripts/sync.py --soft` exits 1 when pyyaml missing ✅ FIXED in v0.12.2 (F-081)

- **Source**: /harness-boot:init
- **Category**: bug
- **Severity**: annoying
- **What happened**: `/harness-boot:init` §5.5 calls `python3 scripts/sync.py --harness-dir .harness --soft`. On a fresh macOS where the system `python3` doesn't have `pyyaml` installed, the script prints `pyyaml is required` and exits with code 1. Per the init.md contract: "fail-open by design ... prints `sync (initial): fail — <reason>` and **still exits 0**." The actual behavior breaks that contract — the wrapper should catch ImportError and exit 0 in `--soft` mode, otherwise CI/automation that checks the exit code will treat a missing optional dep as a hard init failure.
- **Suggested fix**: wrap the pyyaml import in `scripts/sync.py` so that under `--soft`, an ImportError prints `sync (initial): fail — pyyaml not available` and `sys.exit(0)` instead of bubbling up.
- **Resolution**: F-081 (v0.12.2) wraps `import yaml` with `_YAML_AVAILABLE` flag. `main()` inspects raw argv before argparse so `--soft + yaml missing` short-circuits with `print("sync (initial): fail — pyyaml not available …")` and `return 0` (F-076 contract preserved). Strict path keeps `return 1` with a stderr install hint.
