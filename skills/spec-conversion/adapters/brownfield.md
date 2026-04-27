# Adapter: brownfield

**출처 샘플**: F-036 fixtures (`tests/fixtures/brownfield-repos/`)
**버전**: 0.1

---

## 0. 버전 히스토리

| 버전 | 변경 | 날짜 |
|------|------|------|
| 0.1 | F-036 동시 신설. `/harness-boot:init` 옵션 3 (brownfield · existing_code) 진입로. | 2026-04-27 |

---

## 1. 도메인 시그널

이 어댑터는 **입력 형태가 "기존 코드"** 일 때 활성화된다. 다른 어댑터(saas / library / worker / game / meta)는 **도메인 시그널**에 따라 *합성* 가능.

- **강한 신호**
  - 매니페스트 1개 이상 존재 — `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`
  - `.harness/spec.yaml` 부재 (init 시점)
  - 사용자 자연어 — "이미 있는 코드", "기존 프로젝트", "옵션 3"
- **중간 신호**
  - `README.md` 존재 + 코드 디렉터리(`src/`, `lib/`, `app/`) 존재
  - `docs/adr/`, `docs/decisions/` 디렉터리
- **약한 신호**
  - `.git/` 존재 (히스토리 유무는 본 어댑터에서 사용하지 않음 — out-of-scope)

**판정 기준**: 강한 신호 1개라도 → brownfield 어댑터 활성. 매니페스트 0개면 어댑터 부적합 → 옵션 1 fallback.

---

## 2. 결정론 정찰 (LLM 호출 전 필수)

LLM 호출 전에 항상 다음 결정론 모듈을 먼저 실행하여 시드 슬롯을 채운다:

```
python3 -m scripts.scan.seed_spec --root <repo> --preview
```

이 출력은 다음 슬롯을 이미 채운 상태로 stdout YAML 으로 나온다:

| 슬롯 | 출처 |
|------|------|
| `project.name` | manifest:.name → directory basename |
| `constraints.tech_stack.{runtime,language,test,build,min_version}` | manifest 결정론 |
| `metadata.source.origin = "existing_code"` | 고정값 |
| `metadata.source.maturity = "implementation"` | 고정값 |
| `metadata.scan.{top_dirs, adr_dir, readme_path, entity_candidate_count}` | structure 결정론 |
| `features[0]` (Walking Skeleton F-0) | 자동 삽입 |
| `deliverable.type` | runtime 기반 추정 (사용자 confirm 필수) |

**LLM 은 결정론이 채우지 못한 슬롯만** 정찰한다. 결정론으로 가능한 것을 LLM 에 맡기면 단가 + 비결정성 모두 손해.

---

## 3. LLM 정찰 책임 (Stage 1 — Reconnaissance)

| 슬롯 | 입력 | 출력 |
|------|------|------|
| `domain.overview` | README 첫 1~3 단락 | 한 단락 prose |
| `domain.entities[]` | `metadata.scan.entity_candidate_files` 의 파일들 | 3~7 entity (name + description) |
| `domain.business_rules[]` | README "rules/policy/제약" + 코드 주석 invariant | BR-NNN 원형 (선택 — MAY) |
| `decisions[]` | `metadata.scan.adr_dir` 가 있을 때 한정 | ADR-NNN 카탈로그 |

LLM 결과는 모두 `_seed_status: "draft"` 마커 동반. `compose_seed(llm_entities=...)` 가 자동 부여 (`scripts/scan/seed_spec.py`).

---

## 4. 매핑 휴리스틱 (H-BF-1 ~ H-BF-8)

- **H-BF-1**: `package.json` deps 에 `react`/`vue`/`svelte` + entity 후보 파일 0개 → entities 시드 스킵 (UI 코드, 도메인 모델 미공개). overview 만 시드.
- **H-BF-2**: `pyproject.toml` + `models.py` 발견 → Pydantic / SQLAlchemy / dataclass 클래스 이름을 entity name 후보로.
- **H-BF-3**: `*.entity.ts` 파일 → 클래스명을 entity name (TypeORM/NestJS 패턴).
- **H-BF-4**: README 의 `## Domain` (또는 한국어 `## 도메인`) 섹션 존재 시 우선 사용. 없으면 첫 비-h1 단락.
- **H-BF-5**: monorepo 신호 (`pnpm-workspace.yaml`, `lerna.json`, `nx.json`) 검출 → unrepresentable.md 에 한 줄 + 첫 매니페스트만 정찰 (보수적).
- **H-BF-6**: `docs/adr/` · `docs/decisions/` 의 `*.md` 를 ADR-NNN 자동 채번 (파일명 정렬 순). 헤딩 첫 줄을 `decisions[].title` 로.
- **H-BF-7**: 매니페스트 0개 → 어댑터 부적합. 옵션 1 fallback (starter template byte-equal).
- **H-BF-8**: LLM 가 모호하다고 판단한 entity 는 description 끝에 `(draft — please review)` 추가. 사용자 승인 게이트의 친화 신호.

---

## 5. 함정 (X-BF-1 ~ X-BF-3)

- **X-BF-1**: LLM 결과 entity 가 7개 초과 → description 명확도 상위 7개만 채택. 나머지는 unrepresentable.md.
- **X-BF-2**: README 미존재 → `domain.overview = ""` 유지. `project.summary` 는 placeholder (`{name} — seeded from existing repository`). 사용자가 채우도록 위임.
- **X-BF-3**: 시드 후 `scripts/spec/validate.py` 실패 → 사용자에 에러 노출 + 옵션 1 fallback 권장. (LLM 출력의 schema 위반 자동 복구 X — 디버깅성 우선.)

---

## 6. Draft 마커 규약

모든 LLM-시드 entity 항목은 `_seed_status: "draft"` 키 동반. 사용자가 confirm/수정하면 이 키를 삭제 (사용자 책임). 본 어댑터는 자동 promotion 하지 않음 (edit-wins 보존).

```yaml
domain:
  entities:
    - name: User
      description: "Account holder placing orders. (draft — please review)"
      _seed_status: draft
```

---

## 7. 도메인 어댑터와의 합성

brownfield 는 **입력 형태**에 대한 어댑터지 도메인 어댑터가 아니다. 결정론 정찰 후, runtime + dependencies 시그널로 도메인 어댑터를 추가 호출하여 도메인-특화 갭 매트릭스를 적용:

| 결정론 시그널 | 합성할 도메인 어댑터 |
|---------------|----------------------|
| `package.json` deps `react` + `next` / `express` | `saas.md` |
| `Cargo.toml` `[[bin]]` 단일 | (cli — meta.md 의 host-plugin 아님) |
| `package.json` 에 `peerDependencies` + library 패턴 | `library.md` |
| cron / 큐 / ETL 키워드 README + worker deps | `worker.md` |
| 게임루프 / 스프라이트 / `phaser` deps | `game.md` |
| `.claude/` / `commands/` / claude-code-plugin | `meta.md` |

---

## 8. 산출물

| 파일 | 책임 |
|------|------|
| `.harness/spec.yaml` | seed_spec.py 가 생성. `_seed_status: draft` 마커 보존. |
| `unrepresentable.md` | LLM 정찰에서 매핑 못 한 README 섹션 / monorepo 신호 / 7-초과 entity. |
| `conversion-notes.md` | 휴리스틱 충돌 · 사용자 승인 시점 망설임 기록. |

---

## 9. 어댑터 외 책임 (out-of-scope)

- 코드 자동 수정 — 본 어댑터는 **읽기만**.
- ESLint / Prettier / ruff / black 설정 학습 — Layer B (F-037 candidate) 영역.
- Git 히스토리 분석 — LLM 토큰 폭주 + 노이즈 큼. 별 가치 입증 시까지 보류.
- `.harness/spec.yaml` 이 이미 존재하는 update — `init` 의 §0 가 차단. update 모드는 별도 명령 영역.
