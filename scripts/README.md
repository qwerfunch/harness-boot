# scripts/ — 모듈 인벤토리

> 이 README 는 `scripts/` 하위 Python 모듈의 책임과 의존 방향을 한 페이지로 설명한다. 새 기여자가 어디에 코드를 추가해야 하는지, 어떤 파일이 공개 CLI 인지 즉시 파악하도록 유지.

## 레이아웃

```
scripts/
├── README.md                      ← 이 문서
├── self_check.sh                  ← 레포 SSoT/derived 자가 검증 (bash)
│
├── 공개 CLI (commands/*.md 가 PLUGIN_ROOT/scripts/<name>.py 로 호출)
│   ├── sync.py · work.py · status.py · check.py · events.py · metrics.py
│   ├── spec 파이프라인 : validate_spec.py · explain_spec.py · spec_diff.py · spec_mode_classifier.py · mode_b_extract.py
│   └── ceremony (v0.6+): kickoff.py · retro.py · design_review.py · inbox.py
│
├── 공유 유틸 (공개 CLI 간 공통)
│   ├── state.py           ← .harness/state.yaml 읽기/쓰기
│   ├── canonical_hash.py  ← YAML → JSON → SHA-256 Merkle (F-010)
│   ├── plugin_root.py     ← 4-전략 PLUGIN_ROOT 해석 (F-011)
│   └── gate_runner.py     ← gate_0~5 + gate_perf 자동 실행
│
├── render/                 ← spec.yaml → 파생 md/yaml (내부 전용)
│   ├── domain.py           ← domain.md 렌더 (v0.7.4 Platform 섹션 포함)
│   └── architecture.py     ← architecture.yaml 렌더
│
└── spec/                   ← spec.yaml 전처리 · 변환 (내부 전용)
    ├── include_expander.py   ← $include depth=1 전개 (F-009)
    ├── conversion_diff.py    ← 변환 round 간 의미 diff
    ├── upgrade_to_2_3_8.py   ← 구 spec 형식 마이그레이션
    └── mode_b/               ← Mode B BM25 통계 추출
        ├── axes.py           ← 축별 스코어링
        ├── roundtrip.py      ← 재변환 안정성 점검
        └── stopwords.py      ← 영/한 불용어 + 한국어 조사
```

## 책임 경계

| 레이어 | 책임 | 호출 방향 |
|---|---|---|
| commands/*.md | 사용자 인터페이스 · Preamble 규약 · anti-rationalization | 공개 CLI 호출 |
| 공개 CLI | `argparse` · human/json 포맷 · exit code 계약 | 공유 유틸 + 내부 서브패키지 호출 |
| 공유 유틸 | 여러 CLI 가 사용하는 순수 logic | 상호 호출 가능 |
| 내부 서브패키지 | 특정 CLI 전용 | 공유 유틸만 호출 (역방향 금지) |

## 의존 방향 (요약)

```
commands/*.md
      │
      ▼
  공개 CLI ─────► render/  (sync.py 만)
      │    └───► spec/     (sync.py, check.py)
      │    └───► spec/mode_b/ (mode_b_extract.py 만)
      ▼
  공유 유틸 (state · canonical_hash · plugin_root · gate_runner)
```

역방향 (내부 서브패키지 → 공개 CLI) 금지. 레이어 스킵 (commands → 공유 유틸) 도 금지 — commands 는 항상 공개 CLI 를 경유.

## Python 패키지 구조

- `scripts/` 자체는 pip 설치 대상이 아님. 실행 시 각 공개 CLI 스크립트가 자기 부모를 `sys.path` 에 prepend → 다른 형제 모듈을 bare `import` 로 참조.
- 하위 subdir 는 `__init__.py` 가 있어 정식 Python 패키지 — `from spec import include_expander`, `from render import domain` 형태로 참조.

## 공개 CLI 목록 (commands/*.md 가 레퍼런스하는 경로)

| 스크립트 | 용도 | 슬래시 명령 |
|---|---|---|
| `sync.py` | spec → 파생 재생성 | `/harness:sync` |
| `work.py` | 피처 사이클 (activate · gate · evidence · complete) | `/harness:work` |
| `status.py` | 현 상태 스냅샷 | `/harness:status` |
| `check.py` | 10 종 drift 탐지 | `/harness:check` |
| `events.py` | `events.log` 조회/필터 | `/harness:events` |
| `metrics.py` | lead time · gate pass rate 집계 | `/harness:metrics` |
| `spec_mode_classifier.py` | Mode E/A/R/B-1/B-2 분류 | `/harness:spec` |
| `explain_spec.py` | Mode E (설명-only) | `/harness:spec` (Mode E) |
| `spec_diff.py` | 두 spec 간 의미 diff | `/harness:spec` |
| `validate_spec.py` | JSONSchema 2020-12 검증 | `/harness:spec` pre-flight |
| `mode_b_extract.py` | plan.md → spec.yaml 변환 통계 추출 | `/harness:spec` (Mode B) |
| `kickoff.py` | Kickoff ceremony 템플릿 (v0.7 auto-wire) | `/harness:work activate` |
| `retro.py` | Retrospective ceremony 템플릿 (v0.7 auto-wire) | `/harness:work --complete` |
| `design_review.py` | Design review ceremony 템플릿 | orchestrator 수동 (v0.8 auto-wire 후보) |
| `inbox.py` | Q&A file-drop 폴링 | orchestrator 수동 |
| `gate_runner.py` | gate_0~5 + gate_perf 자동 실행 | `work.py --run-gate` 경유 |
| `state.py` | `.harness/state.yaml` 헬퍼 (라이브러리) | 직접 실행 없음 |
| `plugin_root.py` | PLUGIN_ROOT 4-전략 해석 | `/harness:init` |
| `canonical_hash.py` | YAML canonical hash + Merkle | `sync` 내부 |

## 테스트

- `tests/unit/test_*.py` — 각 모듈당 최소 1 파일. 현재 602 tests.
- `tests/regression/conversion-goldens/` — 8 golden 스펙 + MANIFEST.
- `scripts/self_check.sh` — 5 단계 SSoT/derived 자가 검증 (레포 내부 dogfood).

## 버전 정책

- 공개 CLI 경로 (`scripts/<name>.py`) 변경은 **major bump** (v1.0 이상).
- 내부 서브패키지 (`scripts/render/*`, `scripts/spec/*`) 는 자유 재편.
- 새 모듈 추가 시 이 README 업데이트 필수.
