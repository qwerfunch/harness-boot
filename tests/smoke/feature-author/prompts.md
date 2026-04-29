# Trigger prompts — feature-author skill

Eight prompts (4 shapes × Korean / English). Each row tells you the
shape Claude should detect and the adapter file the skill should
consult.

| # | Prompt | Lang | Expected shape | Adapter |
|---|---|---|---|---|
| 1 | 로그인 기능 구현해줘 | ko | sensitive | adapters/sensitive.md |
| 2 | implement OAuth2 login flow | en | sensitive | adapters/sensitive.md |
| 3 | 사용자 대시보드 페이지 만들어줘 | ko | ui-surface | adapters/ui-surface.md |
| 4 | add a settings dialog with WCAG focus management | en | ui-surface | adapters/ui-surface.md |
| 5 | API 응답 p95 200ms 안에 들어와야 함 | ko | performance-budget | adapters/performance-budget.md |
| 6 | LCP under 2500ms, bundle below 200KB gzipped | en | performance-budget | adapters/performance-budget.md |
| 7 | semver 문자열 파서 추가해줘 | ko | pure-domain | adapters/pure-domain.md |
| 8 | aggregate weekly events into per-user summary | en | pure-domain | adapters/pure-domain.md |

## How to use

1. Copy `seed-spec.yaml` to `/tmp/feature-author-smoke/.harness/spec.yaml`.
2. Open Claude Code in `/tmp/feature-author-smoke/`.
3. Type one prompt from the table.
4. Compare Claude's response to `walkthroughs/<shape>.md` for that shape.

## Korean natural-phrasing patterns to spot-test

These are the patterns that **must** trigger the skill (confirmed in
`SKILL.md` `when_to_use`):

```
"X 기능 구현해줘"     "X 기능 만들어줘"     "X 추가해줘"     "X 개발해줘"
"로그인 기능 만들자"  "결제 붙이자"         "회원가입 구현"   "X 작업할게"
"새 피처 추가"        "피처 추가하자"        "F-N 정의"       "spec.yaml 에 추가"
```

If Claude does **not** auto-load the skill on any of these, the
`when_to_use` description has a gap and needs widening.
