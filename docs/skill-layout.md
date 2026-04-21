# SKILL.md Layout & Linter (F-005)

> **doc_sync 대상** — 이 문서는 `src/core/skill/**/*.ts` 와 `skills/**/SKILL.md`
> 의 변경에 동기화된다 (severity: `error`).  린터 규칙 · 섹션 레이아웃 ·
> Anthropic 호환 정책이 바뀌면 본 문서를 함께 갱신해야 하며, 그렇지 않으면
> `/harness:check` Gate 5 에서 실패한다.

Anthropic 공식 Skill(Progressive Disclosure) 모델을 수용하되, harness-boot
는 **SKILL.md 본문을 500 라인 이하로 고정**하고 Anti-Rationalization 3-섹션
(Rationalization · Red Flags · Verification) 을 `references/rationalization.md`
로 분리하는 것을 구조적으로 강제한다 (BR-006 · C4 해소).

---

## 1. 파일 레이아웃

```
skills/<skill-name>/
├── SKILL.md                         # 필수 · ≤ 500 라인 · 프런트매터 포함
└── references/
    ├── rationalization.md           # Rationalization / Red Flags / Verification
    └── *.md                         # 추가 레퍼런스 (자유 형식)
```

| 경로 | 역할 | 린터 대상 |
|---|---|---|
| `skills/<name>/SKILL.md` | 스킬 진입점.  프런트매터(`name`·`description`) + 본문 | ✓ |
| `skills/<name>/references/rationalization.md` | Anti-Rationalization 3-섹션 전용 | 위치 검증(간접) |
| `skills/<name>/references/*.md` | 기타 상세 레퍼런스 | — |

사용자 저장소(`.claude/skills/**`) 로의 1:1 파생은 F-007 (`/harness:analyze`)
이 담당한다 — 린터는 플러그인 소스만 직접 검사한다.

## 2. 프런트매터

```yaml
---
name: <skill-id>
description: "Use this skill when ..."
---
```

- `name` · `description` 두 키는 필수.  누락 시 `skill/frontmatter-required`
  로 error.
- YAML 라이브러리 의존을 피하기 위해 단순 `key: value` · `key: "quoted"` ·
  `key: 'quoted'` 세 형태만 지원한다.  중첩·리스트가 필요해지면 js-yaml 로
  교체한다 (`src/core/skill/parser.ts` 주석 참조).

## 3. 린터 규칙

`lintSkillMd(source, options?)` 는 세 규칙을 적용해 `SkillLintReport` 를
반환한다.

| 규칙 ID | 조건 | severity |
|---|---|---|
| `skill/line-count` | 본문(프런트매터 제외) 라인 수 > `maxBodyLines` (기본 500) | error |
| `skill/frontmatter-required` | 프런트매터 자체가 없거나 `name` · `description` 중 하나라도 없음 | error |
| `skill/rationalization-location` | 본문 헤딩 중 `Rationalization` · `Red Flags` · `Verification` 이 존재 (대소문자 무시, 코드 펜스 내부는 제외) | error |

`options.maxBodyLines` 로 상한을 재정의할 수 있다 (CI 프리셋 · 테스트용).
`hasErrors(report)` 헬퍼는 `severity: 'error'` 위반이 하나라도 있으면
`true` 를 반환한다.

### 3.1 라인 수 계산

- 프런트매터(`--- ... ---`) 블록은 제외한다.
- 빈 줄 · 코드 펜스 · 주석 모두 세어, 원본 그대로의 본문 크기를 본다.
- 정확히 500 라인은 허용 · 501 라인부터 error — "≤ 500" 의 경계는 포괄적
  (inclusive).

### 3.2 헤딩 위치 검사

`findAntiRationalizationHeadings` 는 본문에서 `#` / `##` / `###` 등 ATX
헤딩을 추출하고, 코드 펜스(```` ``` ```` · `~~~`) 내부는 스킵한다.  3-섹션
헤딩 문자열은 `ANTI_RATIONALIZATION_HEADINGS` 상수로 중앙화되며
대소문자 무시로 매칭된다.

## 4. Anthropic 스킬 호환 정책 (AC3)

Anthropic 공식 스킬(docx · pptx · pdf · xlsx · brand-guidelines · canvas-design
· frontend-design · internal-comms · mcp-builder · skill-creator) 10 종은
자체 정책으로 500 라인을 초과할 수 있다 (docx 는 590 라인 수준).  따라서
본 린터의 호환 기준은 다음과 같다.

- **구조 규칙은 강제** — `skill/frontmatter-required` ·
  `skill/rationalization-location` 위반은 허용되지 않는다.  Anthropic 스킬
  도 본 규칙은 통과해야 한다 (실측 기준).
- **라인 수 정책 초과는 허용** — `skill/line-count` 단독 위반은 호환성
  실패로 취급하지 않는다.  harness-boot 가 작성하는 사내 스킬은 상한을
  지키되, 외부 스킬을 재배치할 때는 우선 파싱 가능성만 확인한다.

Anthropic 실제 스킬 저장소는 gitignore 되어 있으므로, 회귀 방어는
`tests/core/skill/lint.test.ts` 의 `it.each(anthropicLikeSkills)` 픽스처 10
개 — 각 스킬의 본문 크기와 프런트매터 형태를 관측값대로 재현 — 가
대행한다.

## 5. 에러 리포트 구조

```ts
type SkillLintViolation = {
  rule: 'skill/line-count' | 'skill/frontmatter-required' | 'skill/rationalization-location';
  severity: 'error';
  message: string;   // 한국어
  line?: number;     // 해당 줄 번호 (rationalization-location 만)
};

type SkillLintReport = {
  violations: SkillLintViolation[];
  parsed: ParsedSkill;   // 프런트매터 · 헤딩 · 본문 · 라인 수
};
```

메시지는 BR-010 에 따라 한국어로 작성한다.  `parsed` 필드는 상위 도구
(`/harness:check`) 가 추가 검사(예: description 길이)를 붙일 수 있도록
원본 파싱 결과를 그대로 노출한다.

## 6. 공개 API 요약

```ts
import {
  parseSkillMd,
  findAntiRationalizationHeadings,
  lintSkillMd,
  hasErrors,
  DEFAULT_MAX_BODY_LINES,
  ANTI_RATIONALIZATION_HEADINGS,
} from '../src/core/skill/index.js';
```

- `parseSkillMd(source)` — 순수 함수, 예외를 던지지 않는다 (불완전 입력은
  `frontmatter: undefined` 로 관용 처리).
- `lintSkillMd(source, options?)` — 순수 함수, 모든 규칙을 한 번의 패스로
  적용.
- `hasErrors(report)` — bool 편의 헬퍼.

## 7. F-007 로의 전개 (AC4 deferral)

F-005 의 AC4 — "플러그인 저장소의 `skills/**` 가 사용자 저장소의
`.claude/skills/**` 로 1:1 파생" — 은 파일 복제/링크 전략이 필요하며,
`/harness:analyze` (F-007) 의 초기화 루틴과 책임이 겹친다.  따라서 본 피처
에서는 **린터만 완성** 하고 파생 동작은 F-007 에서 구현한다.  린터는
플러그인 소스(`skills/**/SKILL.md`) 를 직접 입력으로 받으므로 파생 여부와
무관하게 동작한다.

---

## 참고

- BR-006 — SKILL.md ≤ 500 라인 · Anti-Rationalization 분리 (spec.yaml
  business_rules 참조).
- `spec.yaml` F-005 — acceptance_criteria · doc_sync 계약.
- Anthropic skills (Apache-2.0, 일부 source-available) — Progressive
  Disclosure 모델의 출처.  자세한 라이선스 · URL 은
  `spec.yaml.metadata.external_references.ref.anthropic-skills` 참조.
