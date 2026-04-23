# harness-boot-self — Self-referential Canonical Spec

이 디렉터리는 **harness-boot 플러그인 자체** 를 한 제품으로 간주하고 `docs/schemas/spec.schema.json` 으로 변환한 공식 샘플입니다. 일종의 self-bootstrap 자기참조: 이 spec 이 사용하는 스키마가 곧 이 spec 이 설명하는 그 스키마.

| 파일 | 역할 |
|---|---|
| [`spec.yaml`](spec.yaml) | v2.3.8 canonical spec. 21 features · 8 commands · 6 gates · 9 ambient files. |

## 왜 이게 존재하나

1. **v0.2 피처 설계의 참조점** — `/harness:sync`, `/harness:work`, `/harness:status`, `/harness:check`, 6 core hooks 등 v0.2 범위의 피처가 이 spec 에 먼저 반영됨. PR 은 "Implements F-NNN per docs/samples/harness-boot-self/spec.yaml" 형태로 작성.
2. **JSONSchema 스트레스 테스트** — 메타 도메인 (스펙 자체를 변환 대상으로 삼는 케이스) 에서 schema 가 얼마나 정확히 자기 자신을 표현하는지 회귀 검증.
3. **v0.2 `/harness:sync` 랜딩 후 dogfood 입력** — 별도 워크스페이스에 이 spec 을 복제해서 `/harness:sync` 를 돌리면 `domain.md` · `architecture.yaml` 이 자동 생성됨. 첫 self-describe round trip.

## 어떻게 쓰나

**읽기 전용 참조 (v0.1.x 현재)**:
```bash
cat docs/samples/harness-boot-self/spec.yaml
```
v0.2 피처 설계 / 구현 시 "이게 뭐하는 피처인지" 를 acceptance_criteria · tdd_focus · source_ref 로 조회.

**dogfood (v0.2 `/harness:sync` 이후)**:
```bash
# 별도 워크스페이스 — repo 자체에는 설치 금지 (CLAUDE.md §7)
mkdir -p ~/Developer/work/harness-boot-selfhost
cd ~/Developer/work/harness-boot-selfhost
cp /path/to/harness-boot/docs/samples/harness-boot-self/spec.yaml .harness/spec.yaml
# (/harness:init 의 --use-existing 플래그가 v0.2 에 랜딩해야 함 — 현재는 init 가 신규 생성만)

# /harness:sync 실행 → .harness/domain.md · architecture.yaml 파생
```

## 변환 계보

| 회차 | 시점 | 스킬 | 비고 |
|---|---|---|---|
| v1 | 2026-04-22 | spec-conversion v0.3 | 첫 회차. `tests/regression/conversion-goldens/harness-boot-self/` 에 보존. |
| v2 | 2026-04-22 | spec-conversion v0.4 + meta 어댑터 v0.2 | NEW-28~36 갭 `metadata.extensions.*` 로 구조화. `design/samples/harness-boot-self/v2/` (로컬). |
| v2 → v2.3.8 | 2026-04-23 | `scripts/upgrade_to_2_3_8.py` | 본 파일. `metadata.*` 네이티브 승격 완료. `agent_permissions` 만 `extensions.*` 유지 (v2.4.0 소관). |

## 제약

- **repo `.harness/` 에 설치 금지** (CLAUDE.md §7: "플러그인은 자기 자신에 설치되지 않음"). 이 spec 은 public 문서로만 쓰고, 실제 dogfood 는 별도 scratch 워크스페이스에서.
- **실제 파생 (`/harness:sync`) 은 v0.2 부터** — 현재는 읽기 전용.
- **`agent_permissions` 블록은 `metadata.extensions.*` 에 남아 있음** — v2.4.0 스키마 확장에서 정식 승격 예정 (RFC `design/rfcs/v2.4.0-schema-expansion.md`).

## 관련 문서

- 원본 설계 문서: `design/harness-boot-design-2.3.7.md` (gitignore, 3,493 줄).
- v2 conversion notes / backlink matrix / unrepresentable gap: `design/samples/harness-boot-self/v2/` (gitignore).
- 스키마: [`docs/schemas/spec.schema.json`](../../schemas/spec.schema.json) (v2.3.8, JSONSchema 2020-12).
- v2.3.8 승격 RFC: `design/rfcs/v2.3.8-metadata-extensions-promotion.md` (gitignore).
