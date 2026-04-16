[English](README.md) | **[한국어](README.ko.md)**

# harness-boot

**상세한 plan MD를 Claude Code 네이티브 멀티 에이전트 하네스로 부팅합니다.**

정교하게 다듬어진 plan을 넣으면, 실행 가능한 ~50개 파일이 나옵니다 — 9개 에이전트, 8개 스킬, 5개 훅, 5개 프로토콜 — TDD 격리, 런타임 가드레일, Opus/Sonnet 모델 라우팅까지 전부 세팅 완료. `/start`만 누르면 됩니다.

---

## 설계는 직접 해오세요. 걸작으로.

> **우리는 설계도를 그리지 않습니다 — 설계도를 따르는 공장을 짓습니다.**
>
> 하네스 엔지니어링에서 설계는 전부입니다. Plan은 깎고, 의심하고, 다시 쓰고, 해체하고, 재구축하고, 또 깎아야 합니다 — 더 이상 깎을 것이 없을 때까지. 이 수준의 정교함을 자동화 플러그인에 욱여넣으면? 겉보기엔 *그럴듯*하지만 실제로는 *그저 그런* 프로젝트가 탄생합니다.
>
> 그래서 의도적으로 선을 그었습니다: **harness-boot은 설계에 손대지 않습니다.** 조금도. 집착에 가까운 기획은 당신의 몫입니다. 아키텍처 고민으로 잠 못 드는 밤도 당신의 것입니다. 그리고 그 plan MD가 하나의 작품이 되었을 때 — 저희에게 건네주세요.
>
> 지루한 부분은 저희가 합니다. 완벽하게.
>
> **완성된 plan을 가져오면 50개 파일을 받아갑니다.
> 냅킨 뒷면 스케치를 가져오면 50개의 후회를 받아갑니다.**

---

## 주요 기능

- **Plan-to-harness 자동 생성** — Plan MD를 읽고 전체 구조를 한 세션에 생성 (Phase 1-6, 각 단계 확인 게이트 포함)
- **TDD 서브 에이전트 격리** — Red/Green/Refactor를 별도 서브 에이전트 컨텍스트에서 실행하여 지식 누출 방지
- **런타임 가드레일** — 보안 게이트, 자동 포매팅, 문서 동기화 강제를 훅으로 구현
- **안티 합리화** — 모든 스킬에 변명-반박 테이블을 내장하여 에이전트의 편법 차단
- **모델 라우팅** — Opus(판단용) / Sonnet(실행용) 분리 (~30% 비용 절감)
- **크로스 세션 상태** — 체크포인트/재개, Initializer/Coding 모드 자동 전환, 상태 일관성 검증
- **품질 게이트** — 5단계 게이트 (TDD -> 구현 -> 리뷰 -> 테스트 -> 배포), 각 단계별 구체적 증거 요구

## 빠른 시작

```bash
# 1. 클론 후 Claude Code 플러그인으로 로드
git clone <this-repo>
cd harness-boot
claude --plugin-dir .

# 2. plan 투입
/setup path/to/plan.md

# 3. 생성 단계(1-6) 확인 프롬프트에 응답

# 4. 개발 시작 — 다음 피처를 선택하고 TDD 사이클 실행
/start
```

## 명령어

| 명령어 | 용도 | 사용 시점 |
|--------|------|-----------|
| `/setup <plan.md>` | 상세 plan으로부터 하네스 구조 생성 | 프로젝트 시작 시 1회 |
| `/start` | 개발 시작 (다음 피처의 TDD 사이클 실행) | 하네스 준비 완료 후, 반복 사용 |

<details>
<summary><strong>생성되는 하네스 구조</strong></summary>

```
project-root/
├── CLAUDE.md                  # 메인 요약 (<1,500 토큰)
├── PROGRESS.md                # 상태 추적 + 체크포인트/재개
├── feature-list.json          # 피처 목록 + 통과 상태
├── CHANGELOG.md               # 변경 이력
├── .claude/
│   ├── settings.json          # 훅 설정
│   ├── agents/                # 9개 서브 에이전트 (프론트매터로 모델 라우팅)
│   ├── skills/                # 8개 스킬 (Anthropic Agent Skills 포맷)
│   ├── protocols/             # TDD, 반복 수렴, 문서 동기화 등
│   ├── examples/              # 골든 샘플
│   └── *.md                   # context-map, security, quality-gates 등
├── hooks/                     # 5개 실행 가능 훅 스크립트
└── scripts/                   # 자동화 유틸리티
```

</details>

## 작동 원리

생성되는 모든 하네스를 지배하는 4가지 원칙:

1. **TDD-First** — 테스트 작성자, 구현자, 리팩터러가 격리된 서브 에이전트 컨텍스트에서 실행. 메모리 공유 없음, 부정행위 불가.
2. **반복 수렴** — 피처당 최대 5회 반복. 수렴하지 못하면 무한 루프 대신 사용자에게 에스컬레이션.
3. **코드-문서 동기화** — 3중 방어: 프롬프트 프로토콜이 에이전트에게 동기화를 지시, PreToolUse 훅이 미동기화 커밋을 차단, 리뷰어가 재확인.
4. **안티 합리화** — LLM은 "이 작은 변경에는 테스트가 필요 없어"라고 스스로를 설득하는 데 탁월합니다. 모든 스킬에 반박 테이블을 내장: *"네가 X라고 말할 거 알아. Y 때문에 틀렸어."*

---

**문서:** [하네스 엔지니어링 가이드](docs/setup-guide.md) | [킥오프 프롬프트](docs/start-prompts.md)

**참고 자료:** [Anthropic Skills](https://github.com/anthropics/skills) | [Agent Skills Collection](https://github.com/addyosmani/agent-skills) | [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)

**라이선스:** MIT
