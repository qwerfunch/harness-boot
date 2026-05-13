# Benchmark Setup — SWE-bench Verified A/B

> 외부 환경에서 실측 진행 절차. 이 디렉터리의 framework + scripts 가 fixed, 사용자가 외부 환경에서 한 번 setup 후 task 단위로 반복.

---

## 1. Prerequisites

| 도구 | 용도 | 설치 |
|---|---|---|
| **Python 3.10+** | SWE-bench harness | `brew install python@3.11` or system pkg |
| **Docker Desktop** | task 환경 격리 (각 repo + base commit) | https://docs.docker.com/get-docker/ |
| **git** | repo clone | 사전 설치 |
| **harness-boot CLI** | harness 측 시도 | `node bin/harness` (이 repo) — already installed |
| **Claude Code (Anthropic)** | 양쪽 시도의 LLM 호출 surface | 사용자 본인 환경 |
| **모델 access** | Sonnet 4.6 (또는 사용자 선택) | Anthropic API key 또는 Claude Code 구독 |

**시간 / 비용 예상**:
- task 당 wall time 5-30분
- task 당 model cost $1-10 (Sonnet 기준)
- 20 task × 2 approach = 40 run × 평균 $3 = **$120**
- 양쪽 합산 시간 ~ 8-15 시간 (병렬 X)

---

## 2. SWE-bench harness 설치

```bash
# 별도 작업 디렉토리
mkdir -p ~/swe-bench-ab && cd ~/swe-bench-ab

# SWE-bench 공식 repo
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench
pip install -e .

# Verified subset 추출 — 이 repo 의 tasks.json 활용
python -c "
import json
from datasets import load_dataset
ds = load_dataset('princeton-nlp/SWE-bench_Verified', split='test')
with open('/path/to/harness-boot/docs/benchmark/swe-bench-verified/tasks.json') as f:
    chosen = {t['task_id'] for t in json.load(f)['tasks']}
subset = ds.filter(lambda r: r['instance_id'] in chosen)
subset.to_json('verified_subset_20.jsonl')
print(f'{len(subset)} tasks ready')
"

# Docker images preload (각 repo 의 base commit 환경)
python -m swebench.harness.run_evaluation \
  --instance_ids $(python -c "import json; print(' '.join(t['task_id'] for t in json.load(open('verified_subset_20.jsonl'))))") \
  --predictions_path /dev/null \
  --max_workers 2 \
  --run_id setup-warmup \
  --cache_level instance
```

이 단계 ~1시간 (이미지 다운로드 + venv 빌드).

---

## 3. Per-task 실행 (vanilla 시도)

각 task 에 대해 `run-vanilla.sh <task_id>` 호출:

```bash
cd ~/swe-bench-ab
export TASK_ID="django__django-13551"
bash /path/to/harness-boot/docs/benchmark/swe-bench-verified/scripts/run-vanilla.sh "$TASK_ID"
```

이 스크립트가 하는 일:
1. Task 의 base commit 으로 repo 체크아웃 (Docker 안)
2. Issue body 를 prompt 로 만들어 Claude Code 에 전달
3. 사용자가 Claude Code 안에서 수정 작업 (turn-by-turn 자연어)
4. 매 turn 끝나면 `/cost` 결과를 prompts log 에 기록
5. Patch 가 SWE-bench harness 의 test 를 통과하면 resolved=true
6. 결과를 `results/vanilla/<task_id>.json` 으로 저장

**측정 정확도 주의**: vanilla 시도는 사람이 token 입력을 잊을 수 있음. setup.md §6 의 체크리스트로 매 turn 직후 입력.

---

## 4. Per-task 실행 (harness 시도)

```bash
cd ~/swe-bench-ab
export TASK_ID="django__django-13551"
bash /path/to/harness-boot/docs/benchmark/swe-bench-verified/scripts/run-harness.sh "$TASK_ID"
```

스크립트 흐름:
1. Task 의 base commit 으로 repo 체크아웃 (Docker)
2. `harness init` 호출 — auto-routing 으로 existing_code scenario
3. Issue body 를 spec.yaml 의 새 feature 로 등록 (F-1 같은)
4. `harness work F-1` activate
5. 사용자가 Claude Code 안에서 작업 (harness routing 활용)
6. `harness token --in X --out Y --model M --feature F-1` 매 LLM 호출 직후
7. gate + evidence + complete
8. Patch 가 SWE-bench test 통과 → resolved=true
9. `harness metrics --json` 의 token + `events.log` 의 drift catches 추출
10. `results/harness/<task_id>.json` 저장

---

## 5. 집계

20 task 양쪽 모두 끝나면:

```bash
python /path/to/harness-boot/docs/benchmark/swe-bench-verified/scripts/aggregate.py \
  --results-dir /path/to/harness-boot/docs/benchmark/swe-bench-verified/results \
  --tasks /path/to/harness-boot/docs/benchmark/swe-bench-verified/tasks.json \
  --report /path/to/harness-boot/docs/benchmark/swe-bench-verified/REPORT.md
```

이 스크립트가 REPORT.md 의 §2.1, §2.2, §2.3, §3 표를 자동 갱신. §4 정성 관찰과 §5 결론은 사람 손으로.

---

## 6. 토큰 측정 체크리스트

매 task 양쪽 시도 시 같은 절차:

- [ ] turn 시작 직전 `/cost` 실행 → start_tokens 기록 (수기)
- [ ] turn 진행 (LLM 호출 N 번)
- [ ] turn 끝나면 `/cost` 다시 실행 → end_tokens 기록
- [ ] delta = end - start
- [ ] vanilla: result JSON 에 누적 입력
- [ ] harness: `harness token --in delta_in --out delta_out --model M --feature F-N` 즉시 호출

자동화는 F-172 의 follow-up (Claude Code session-end hook) 가 land 한 후. 그 전까지 수기 의무.

---

## 7. 결과 commit + PR

20 task 완료 + REPORT.md 갱신 후:

```bash
cd /path/to/harness-boot
git checkout -b benchmark/swe-bench-results-<date>
git add docs/benchmark/swe-bench-verified/results/
git add docs/benchmark/swe-bench-verified/REPORT.md
git commit -m "benchmark: SWE-bench Verified A/B results (N=20, model=<id>)"
git push -u origin HEAD
gh pr create --base develop --title "benchmark: SWE-bench Verified A/B results"
```

PR 머지 후 project root README 에 link 추가 — marketing 자리 (Status / Built with 근처).

---

## 8. Trouble shooting

| 증상 | 원인 | 해결 |
|---|---|---|
| Docker 이미지 다운로드 실패 | network / Anthropic registry timeout | `--max_workers 1` 로 sequential, 재시도 |
| Test PASS 인데 swebench 가 fail 처리 | hidden test 의 flake | 같은 task 2-3회 시도 후 majority |
| `harness token` 호출이 events.log 에 안 보임 | `--harness-dir` 의 path 오류 | `--harness-dir "$(pwd)/.harness"` 절대경로 |
| Vanilla turn 끝났는데 `/cost` 가 0 | Claude Code 의 cost tracking 비활성 | `claude config` 에서 token tracking 활성 |

---

## 9. Pilot 권장

20 task 전부 진행 전, **5 task pilot** 권장:
- 쉬운 1 (matplotlib-23314)
- 중간 3 (django-13551 · sphinx-8721 · pandas-50266)
- 어려운 1 (sympy-20639)

Pilot 으로 framework 검증 + 측정 시간 / 비용 정확히 산정 → 20 task full run 결정.
