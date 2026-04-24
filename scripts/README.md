# scripts/ — 모듈 인벤토리

> `scripts/` 의 Python 모듈 책임과 의존 방향을 한 페이지로 설명한다. 새 기여자가 어디에 코드를 추가해야 하는지, 어떤 파일이 사용자 대면 계약에 속하는지 즉시 파악하도록 유지.

## 레이아웃

```
scripts/
├── README.md                      ← 이 문서
├── self_check.sh                  ← 레포 SSoT/derived 자가 검증 (bash)
│
├─ 루트 (6 primary command entry points)
│   sync.py · work.py · status.py · check.py · events.py · metrics.py
│   commands/*.md 이 `$PLUGIN_ROOT/scripts/<name>.py` 로 직접 호출.
│
├── core/                          ← 공유 저수준 유틸
│   ├── state.py                   ← .harness/state.yaml 헬퍼
│   ├── canonical_hash.py          ← YAML → JSON → SHA-256 Merkle (F-010)
│   └── plugin_root.py             ← 4-전략 PLUGIN_ROOT 해석 (F-011)
│
├── gate/
│   └── runner.py                  ← gate_0~5 + gate_perf 자동 실행
│
├── ceremonies/                    ← v0.6 4 ceremonies
│   ├── kickoff.py                 ← v0.7 auto-wired from work.activate
│   ├── retro.py                   ← v0.7 auto-wired from work.complete
│   ├── design_review.py           ← 수동 (v0.8+ auto-wire 후보)
│   └── inbox.py                   ← Q&A file-drop 폴링
│
├── spec/                          ← spec.yaml 파이프라인
│   ├── validate.py                ← JSONSchema 2020-12 검증
│   ├── explain.py                 ← Mode E (read-only 설명)
│   ├── diff.py                    ← 두 spec 의미 diff (Mode A/R)
│   ├── mode_classifier.py         ← Mode E/A/R/B 자동 분류
│   ├── mode_b_extract.py          ← Mode B BM25 통계 추출 CLI
│   ├── include_expander.py        ← $include depth=1 전개 (F-009)
│   ├── conversion_diff.py         ← 변환 round 의미 diff
│   ├── upgrade_to_2_3_8.py        ← 구 스펙 마이그레이션
│   └── mode_b/                    ← Mode B BM25 내부
│       ├── axes.py
│       ├── roundtrip.py
│       └── stopwords.py
│
└── render/                        ← spec → 파생 md/yaml
    ├── domain.py                  ← domain.md (v0.7.4 Platform 섹션 포함)
    └── architecture.py            ← architecture.yaml
```

## 레이어 책임

| 레이어 | 책임 | 호출 방향 |
|---|---|---|
| `commands/*.md` | 사용자 UI · Preamble · Anti-rationalization | 루트 CLI 를 호출 |
| 루트 `scripts/*.py` | argparse · human/json 포맷 · exit code 계약 | 서브패키지를 조합 |
| `core/` | 저수준 유틸 · 순수 | 아무 것도 호출하지 않음 (외부 의존 = pyyaml) |
| `gate/` · `ceremonies/` · `spec/` · `render/` | 도메인별 로직 | `core` 만 호출 |

규칙:

1. 루트 CLI 는 서브패키지 로직만 조합 — 복잡한 로직이 루트로 새어들면 서브패키지로 이동.
2. 서브패키지 간 상호 호출 금지. 공통 저수준은 `core/` 로 승격.
3. 역방향 의존 금지 — 서브패키지가 루트 CLI 를 import 하지 않음.

## 의존 그래프

```
                   commands/*.md
                         │ 호출
                         ▼
       ┌─── sync.py ──── check.py ──── work.py ──── status.py ──── events.py ──── metrics.py
       │                     │             │
       ▼                     ▼             ▼
   render/, spec/         spec/       gate/, ceremonies/
                  \         │         /
                   ▼         ▼        ▼
                        core/
```

## 공개 CLI 경로 (commands/*.md 가 참조)

| 스크립트 | 슬래시 명령 |
|---|---|
| `sync.py` | `/harness:sync` |
| `work.py` | `/harness:work` |
| `status.py` | `/harness:status` |
| `check.py` | `/harness:check` |
| `events.py` | `/harness:events` |
| `metrics.py` | `/harness:metrics` |
| `spec/mode_classifier.py` · `spec/explain.py` · `spec/diff.py` · `spec/validate.py` · `spec/mode_b_extract.py` | `/harness:spec` 각 Mode 위임 |
| `ceremonies/kickoff.py` · `ceremonies/retro.py` | `/harness:work` 가 auto-wire (v0.7) |
| `ceremonies/design_review.py` · `ceremonies/inbox.py` | orchestrator 수동 |
| `gate/runner.py` | `/harness:work --run-gate` 경유 |
| `core/state.py` · `core/plugin_root.py` · `core/canonical_hash.py` | 라이브러리 (다른 CLI 가 임포트) |

## 테스트

- `tests/unit/test_*.py` — 모듈당 최소 1 파일. 602 tests.
- `tests/regression/conversion-goldens/` — 8 golden 스펙 + MANIFEST.
- `scripts/self_check.sh` — SSoT · validate · sync · check · commands 규약 5 단계.

## 버전 정책

- **사용자 대면 계약** = `/harness:*` 슬래시 명령 (commands/*.md 의 API 면). 이 계약은 **major bump (v1.0+)** 전에는 변경하지 않는다.
- **내부 구현 경로** (`scripts/**/*.py`) 는 patch 단위로 자유롭게 움직일 수 있다 — commands/*.md 가 동일 커밋에서 갱신되고 전체 테스트가 녹색이면 OK. `/plugin update` 한 번으로 사용자에게 투명하게 반영.
- 새 서브패키지 추가 시 이 README 의 레이아웃 블록 업데이트.
