# Threats to Validity — SWE-bench Verified A/B

> 이 benchmark 의 신뢰도를 약화시킬 수 있는 모든 요인을 명시. 이를 모르고 결과를 마케팅 narrative 로 사용하는 건 부정직.

---

## 1. Construct validity (측정 axis 가 진짜 그걸 재는가)

### 1.1 SWE-bench 의 "resolve" = 정말 사용자가 받을 가치인가?

SWE-bench 의 채점 기준: PR 의 patch 가 hidden test 를 PASS. 즉:
- **잡는 것**: API contract 만족, regression test 통과
- **못 잡는 것**: 코드 가독성, 유지보수성, 비기능 요구사항 (perf, a11y, security), 디자인 적합도

**위협**: harness 가 "test 는 통과하지만 코드가 더 깔끔" 한 경우 SWE-bench resolve rate 는 동일 표시. **harness 의 ceremony · drift 가치가 metric 에 미반영**.

**완화**: §2.1 의 "Code LOC" 와 §4 의 정성적 관찰이 이 gap 을 부분적으로 보완. 단 정량 수치만 인용하면 misleading 가능.

### 1.2 Token 측정의 정확도

- **vanilla**: Claude Code 의 `/cost` 수기 입력. 사용자가 잊거나 잘못 입력 가능.
- **harness**: `harness token` 으로 입력. **agent / subagent 호출의 모든 token 이 capture 되는지는 hook 자동화 (F-172 follow-up) 가 land 한 후에야 보장**. 현재는 매 turn 끝에 수기 입력 필요.

**위협**: 양쪽 다 self-report. underreport 가 같은 방향이면 상쇄, 다른 방향이면 결과 bias.

**완화**: setup.md 의 procedure 가 정확한 측정 시점 (turn 끝 직후) 명시. 양쪽 동일 방식 적용해 bias 최소화.

### 1.3 "Code quality" 의 정의 모호

`code_loc · tests_added` 만으로 quality 추정 어려움. lint score / type check / cyclomatic complexity 같은 정량은 SWE-bench 의 채점에 포함 X.

**위협**: harness 가 "더 짧고 더 명료한 코드" 를 만든다 해도 LOC 만 보면 같음.

**완화**: §2.1 에 추가 metric (cyclomatic complexity, lint warnings 등) 도입 가능. 단 현재 framework 는 LOC 만. 결과 안정화되면 metric 확장.

---

## 2. Internal validity (측정 자체가 정확한가)

### 2.1 Confounders

| Confounder | 영향 | 완화 |
|---|---|---|
| **Same author (Claude)** | vanilla 와 harness 양쪽 모두 같은 모델 인스턴스. 사람 user 가 작성하는 prompt 차이는 통제 X. | setup.md 에서 같은 prompt template 사용 의무화. 단 sub-conversation 의 turn 별 차이 통제 어려움. |
| **Same time / model version** | v0.15.8 의 token 측정 시점 + 특정 모델 release. 6개월 후 같은 비교 해도 결과 다를 수 있음. | result JSON 에 `model · plugin_version · run_date` 메타데이터 필수. |
| **Order effect** | vanilla 먼저 / harness 먼저 의 순서에 따라 task context 가 누적. | 각 task 는 fresh 환경 (Docker / 빈 workdir) 으로 reset. setup.md 강제. |
| **Sample selection bias** | tasks.json 의 20 pick 이 harness-fit task 에 치우치면 결과 bias. | tasks.json 의 selection_criteria 가 명시 — fit-mix (10 multi / 6 medium / 4 single). public 검토 가능. |

### 2.2 SWE-bench 의 task 자체 confound

- **Contamination**: SWE-bench Verified 의 일부 task 가 모델 training 에 포함됐을 가능성. resolve rate 절대값 자체를 신뢰 X.
- **Patch grading 의 non-determinism**: hidden test 자체에 flake (timing, env) 가 있음. 한 task 가 resolve / non-resolve 사이 boundary 일 수 있음.

**완화**: vanilla 와 harness 모두 같은 SWE-bench tasks 사용 → 양쪽 같은 confounder 영향. **상대 차이** 만 유의미하게 해석. 절대값은 외부 인용 시 주의.

---

## 3. External validity (결과를 다른 상황으로 일반화 가능한가)

### 3.1 도메인 일반화

20 task = 9 repo (django · sympy · scikit-learn · matplotlib · sphinx · pytest · requests · flask · pylint · astropy · pandas · xarray). **모두 Python · 모두 OSS · 대부분 mature 라이브러리**.

**위협**: 다음 도메인에 일반화 불가:
- 다른 언어 (TS / Rust / Go) — harness 의 toolchain auto-detect 가 다른 환경에서 어떻게 작동하는지 미측정
- 새 프로젝트 vs 기존 프로젝트 — SWE-bench 의 모든 task 가 mature 라이브러리에 적용. harness 의 `init --scenario idea` 가치는 측정 X
- 상용 프로젝트의 multi-feature workflow — SWE-bench 의 한 task = single issue. harness 의 강점인 누적 retro / Iron Law 매 cycle 검증은 단일 task 측정에 미발현

### 3.2 시간 일반화

이 결과는 v0.15.8 시점 plugin + 특정 모델 release 의 snapshot. v1.0 이후 다시 측정 권장.

### 3.3 사용자 일반화

사용자가 harness 와 vanilla 를 똑같이 능숙하게 사용한다는 가정. 실 사용자는:
- harness 명령 외워야 함 (`harness init` · `harness work` 등)
- vanilla 는 자유 자연어 — 학습 비용 0

→ harness 우위가 정량 수치보다 작을 가능성 (사용자 학습 곡선의 비용 미반영).

---

## 4. Conclusion validity (결론을 어떻게 표현해야 정직한가)

### 4.1 표현 가이드

- "harness 가 더 좋다" ← 위험. axis 명시 필수.
- "20-task SWE-bench Verified subset 에서, single-fix 가 아닌 multi-step task 의 token 평균이 harness N% 감소" ← OK.
- "harness 가 vanilla 대비 우월" ← 위험. dimensional caveat 없음.
- "이 benchmark suite 의 N=20 subset 결과로는, harness 의 우위가 multi-step task 에서 통계적으로 약하게 관찰됨. full 500 run 또는 다른 모델로 확인 권장" ← OK.

### 4.2 null result 정직성

만약 measure 후 "차이 거의 없음" 이면:
- 그 자체가 가치 있는 발견 (harness 의 process metric 우위는 outcome metric 으로 자동 환원 X)
- 마케팅 위해 spin 금지 (BR-014 anti-rationalization)
- 결과 안정화 후 README 의 marketing 자리에는 "outcome metric A/B 결과는 mixed — process metric 우위는 명확" 식의 정직 narrative

---

## 5. 후속 작업

이 framework 가 land 한 후, 결과 신뢰도 ↑ 를 위한 다음 cycle 권장:

1. **Hook 자동화** (F-172 follow-up) — Claude Code session boundary 의 token 자동 capture. 수기 입력 confounder 제거.
2. **Multi-author run** — 외부 dogfood 사용자 (logcat-on · cosmic-suika) 가 같은 framework 로 시도. single-author bias 완화.
3. **Multi-model run** — Sonnet 4.6 · Opus 4.7 · Haiku 4.5 양쪽 비교. 모델 size 가 결과에 미치는 영향 측정.
4. **Code quality metric 추가** — lint score · cyclomatic complexity · type check 통과율 added to schema.
5. **Full 500 run** — pilot 결과 보고 시간/예산 budget 결정 후 진행.
