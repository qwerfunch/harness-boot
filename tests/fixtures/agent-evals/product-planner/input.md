# Test input — product-planner

## Upstream — researcher brief (excerpt)

`.harness/_workspace/research/brief.md` 의 요약:

- JTBD-1: "연습에 몰입하고 싶을 때, 25분 중단 없는 세션을 보장받고 싶다" — solo_musician.
- JTBD-2: "학생 연습 진척을 확인하고 싶을 때, 원격으로 세션 패턴을 공유받고 싶다" — music_teacher.
- Prior art: Be Focused · Forest · Toggl Track. 전부 악기 연습자의 "물리 방해 요인 (폰 알림·이메일·소셜)" 차단에 특화되지 않음.
- Assumption: 데스크탑 1 차 플랫폼, 모바일은 follow-up.
- OQ-1: 오프라인 우선인가 sync 필요한가?
- OQ-2: 세션 기록 자동 공유 vs 수동 배포?
- OQ-3: 유료 기능 경계 어디?

## Task

위 brief 기반으로 `.harness/_workspace/plan/plan.md` 초안 작성. Walking Skeleton (F-0) 은 반드시 포함하며, 이어지는 F-1~F-3 정도까지 핵심 피처와 각 AC 1~2 문장 요약을 제시. 주요 trade-off 는 ADR-001 · ADR-002 로 선결정. Open Questions 중 최소 2 개는 해소(초안 결정) 하고, 해소 불가한 항목은 plan.md 에 그대로 남겨 다음 싸이클로 넘김.

## Constraints

- Walking Skeleton 은 비즈니스 가치 0 · "빈 타이머 빈 화면 1분 카운트다운" 수준
- F-1 에서 비로소 가치 제공 (25+5 자동 전이)
- 모바일은 이 plan 범위 아님 — F-5+ 로 이연
