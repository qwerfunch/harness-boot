# SWE-bench Verified A/B benchmark — harness-boot vs vanilla Claude Code

> Object: **객관적으로 측정** — 같은 task 를 (a) 그냥 Claude Code 와 (b) harness-boot 로 풀었을 때, 결과물 퀄리티 / 토큰 소비 / 목표 달성률에 정량적 차이가 있는가?

이 디렉터리는 **재현 가능한 비교 framework** 입니다. 실측 데이터는 `REPORT.md` 에 누적됩니다.

---

## 1. 왜 SWE-bench Verified?

| 기준 | SWE-bench Verified | 다른 후보 |
|---|---|---|
| 권위 | Anthropic / Princeton 이 표준으로 사용 — 모든 frontier model 의 비교 baseline | HumanEval (단순 함수, contamination) · MBPP (구식) · Aider polyglot (단일 언어 X) |
| 현실성 | 실제 GitHub repo 의 issue → PR. multi-file fix. test 통과 여부로 자동 채점 | LiveCodeBench (월별 갱신 noise) · TAU-bench (도메인 한정) |
| harness fit | **multi-step agentic + AC 명시 가능 + repo-level → harness 의 가치 axis 모두 발현** | HumanEval 류는 single function 이라 harness overhead 가 정량 패배 |
| 외부 인용 가능 | Anthropic / OpenAI / Google 모두 인용 — README marketing 가치 | 자체 benchmark 는 외부 검증 X |

**500 → 20 task 축소 근거**: full run 은 task 당 $1-10 × 모델 × 양쪽 = $40+ × 500 = $20,000 비현실적. 20 task subset 으로 first-order signal 확보 후 결과에 따라 확장.

`tasks.json` 의 20 pick 은 repo 다양성 (django · sympy · flask · pandas · matplotlib · sphinx · scikit-learn · pytest · pylint · requests 등) + difficulty 분포 (hard 4 · medium 12 · easy 4) + harness-fit axis (single-fix vs multi-step) 의 mix.

---

## 2. 측정 4 axis

각 task 의 양쪽 시도 (vanilla · harness) 결과를 `results/<approach>/<task_id>.json` 에 기록. schema:

```json
{
  "task_id": "django__django-13551",
  "approach": "vanilla" | "harness",
  "resolved": true,                          // SWE-bench test harness 가 PASS 판정
  "tokens_input": 123456,                    // 누적 input token (vanilla: /cost 수기, harness: `harness token` 자동)
  "tokens_output": 7890,
  "wall_time_sec": 720,
  "attempts": 1,                             // 같은 task 재시도 횟수
  "code_loc": 45,                            // patch 의 +line - -line
  "tests_added": 3,                          // 새로 작성한 test 수
  "tests_passed": "all" | "partial" | "none",
  "harness_drift_catches": 0,                // harness only: 15-detector 가 잡은 issue 수
  "harness_evidence_kinds": ["manual_check", "test", "..."],  // harness only
  "notes": "..."                             // 정성적 관찰
}
```

집계 (`scripts/aggregate.py`):
- **Resolve rate** = `Σ(resolved == true) / N`
- **Mean tokens per task** = input + output 합산 평균
- **Mean wall time per task** = sec 평균
- **Per-task delta** = harness − vanilla 의 분포

---

## 3. 비교 절차 (재현)

자세한 단계는 `scripts/setup.md`. 요약:

```bash
# 1) SWE-bench 환경 셋업 (한 번만)
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench
pip install -e .

# 2) 20 task subset 추출
python scripts/pick_subset.py --tasks docs/benchmark/swe-bench-verified/tasks.json

# 3) vanilla 시도 (모든 task 순회)
bash docs/benchmark/swe-bench-verified/scripts/run-vanilla.sh

# 4) harness 시도 (모든 task 순회)
bash docs/benchmark/swe-bench-verified/scripts/run-harness.sh

# 5) 집계 + REPORT.md 갱신
python docs/benchmark/swe-bench-verified/scripts/aggregate.py
```

vanilla 와 harness 의 토큰 측정:
- **vanilla**: Claude Code 의 `/cost` 명령을 매 task 직후 호출, 누적값을 result JSON 에 수기 입력
- **harness**: `harness token --in X --out Y --model M --feature F-N` 으로 자동 기록 (F-172 의 인프라)

---

## 4. harness 가 정확히 어떻게 다른가 (가설)

이 비교가 noise 가 아닌 signal 을 잡으려면 가설이 명확해야:

| 가설 | 측정 방법 | 예상 |
|---|---|---|
| harness 는 **AC 미커버 task** 에서 vanilla 보다 더 자주 resolve | `tests_passed == "all"` 비율 | harness +5~15% |
| harness 는 **drift 패턴 (e.g. README 와 code 불일치)** 을 자동 catch | `harness_drift_catches > 0` 인 task 수 | harness 가 vanilla 보다 0~3 건 더 |
| harness 는 **multi-step task** 에서 token 단축 (자동 sync · ceremony 가 manual prompt 절감) | `tokens_input + tokens_output` 평균 | harness −10~30% |
| harness 는 **single-fix task** 에서 token 증가 (boilerplate overhead) | 같은 axis | harness +10~30% |
| harness 는 **resolve rate 자체는 비슷** (모델은 같으니까) | resolve rate | ±0~5% |

→ 결과가 가설과 다르면 그게 더 가치 있는 발견. **null result 도 정직하게 기록**.

---

## 5. 정직한 한계

- **Single model · single author** (Claude). vanilla 와 harness 양쪽 동일 모델 사용. 사람 user 의 prompt 차이는 confounder.
- **Single time**. v0.15.7 시점 plugin · 특정 모델 release 시점.
- **Benchmark contamination**. SWE-bench Verified 의 일부 task 는 training data 에 포함됐을 가능성. resolve rate 자체를 절대값으로 신뢰 X — 두 approach 간 **상대 차이** 가 중요.
- **20 task subset**. 500 의 4%. statistical power 약함. p-value 보다는 effect size 의 magnitude 관찰.
- **harness fit per task**. AC 가 명확한 task 는 harness 우위, 단순 typo fix 는 harness overhead. task selection 의 mix 자체가 결과에 영향.

자세한 분석: `analysis/threats-to-validity.md`.

---

## 6. 산출물 라이프사이클

1. **Framework (이 PR)** — 폴더 / 방법론 / 스크립트 / skeleton — landed v0.15.8
2. **Pilot run (5 task)** — maintainer 가 외부 환경에서 실측, REPORT.md 의 일부 row 채움
3. **Full run (20 task)** — pilot 결과 보고 확장. 별도 cycle.
4. **README link** — 결과 안정화되면 project root `README.md` 의 "Status" / "Built with" 근처에 link 추가

---

## 7. 디렉터리 구조

```
docs/benchmark/swe-bench-verified/
├── README.md                    # 이 파일 — 방법론 + 한계
├── REPORT.md                    # 결과 누적 (실측 후 채움)
├── tasks.json                   # 20-task selection + 근거
├── results/
│   ├── vanilla/<task_id>.json
│   └── harness/<task_id>.json
├── scripts/
│   ├── run-vanilla.sh
│   ├── run-harness.sh
│   ├── aggregate.py
│   └── setup.md
└── analysis/
    └── threats-to-validity.md
```

---

## 8. 인용

이 benchmark suite 의 데이터를 인용할 때:

```
harness-boot SWE-bench Verified A/B (v0.15.8+)
https://github.com/qwerfunch/harness-boot/tree/main/docs/benchmark/swe-bench-verified
```

비교 대상이 vanilla Claude Code 가 아닌 다른 도구라면 fork 후 새 디렉터리로 분기 권장.
