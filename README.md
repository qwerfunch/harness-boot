# harness-boot

**상세 계획 MD를 Claude Code 네이티브 멀티 에이전트 하네스로 부팅합니다.**

> 이미 작성된 상세 계획 MD가 있다면, `harness-boot`이 그것을 읽어 **실행 가능한 하네스**를 자동 생성합니다. TDD 서브에이전트 격리, 코드-문서 동기화 런타임 강제, Anti-Rationalization 스킬, Opus/Sonnet 모델 라우팅이 내장됩니다.

## ✨ 핵심 기능

- **상세 계획 → 하네스 자동 변환** — 50+ 파일 구조(에이전트 9종, 스킬 8종, 훅 5종, 프로토콜 5종)를 한 번에 생성
- **TDD 서브에이전트 컨텍스트 격리** — Red/Green/Refactor를 별도 서브에이전트로 분리
- **런타임 가드레일 (hooks.json)** — 보안, 자동 포맷, 문서 동기화를 시스템 수준에서 강제
- **Anti-Rationalization** — 모든 스킬에 에이전트의 변명과 반론 내장
- **모델 라우팅** — Opus(판단) / Sonnet(실행) 분리로 ~30% 비용 절감
- **크로스 세션 상태 관리** — Initializer/Coding 모드 자동 전환

## 🚀 설치

### 로컬 개발 테스트
```bash
git clone <this-repo>
cd harness-boot
claude --plugin-dir .
```

### 마켓플레이스 설치 (GitHub 배포 후)
```bash
# Claude Code 내에서
/plugin marketplace add github:{your-username}/harness-boot
/plugin install harness-boot@harness-boot-marketplace
```

## 🎯 사용법

```
1. 상세 계획 MD 작성 (프로젝트 요구사항, 기능 명세 등)

2. Claude Code에서 하네스 부팅:
   /setup path/to/plan.md

3. Phase 1~6 생성 및 각 Phase별 확인 후 완료

4. 개발 시작:
   /start
```

### 명령어

| 명령어 | 용도 | 시점 |
|--------|------|------|
| `/setup <plan.md>` | 상세 계획 → 하네스 구조 생성 | 프로젝트 시작 시 1회 |
| `/start` | 개발 시작 (다음 기능 TDD 실행) | 하네스 준비 완료 후, 반복 사용 |

## 📋 생성되는 하네스 구조

```
프로젝트 루트/
├── CLAUDE.md                  # 메인 엑기스 (<1,500 토큰)
├── PROGRESS.md                # 상태 추적
├── feature-list.json          # 기능 목록 + 통과 상태
├── CHANGELOG.md               # 하네스 변경 이력
├── .claude/
│   ├── settings.json          # 훅 설정
│   ├── agents/                # 서브에이전트 9종
│   ├── skills/                # 스킬 8종 (6섹션 Anatomy)
│   ├── protocols/             # TDD, 반복 수렴, 문서 동기화 등
│   ├── references/            # Progressive Disclosure 분리 참조
│   ├── examples/              # 골든 샘플
│   └── *.md                   # context-map, security, quality-gates 등
├── hooks/                     # 실행 가능한 훅 스크립트 5종
└── scripts/                   # 자동화 유틸리티
```

## 🎨 4대 설계 원칙

1. **TDD-First** — 서브에이전트 3분할로 컨텍스트 격리
2. **반복 수렴** — 최대 5회 루프, 초과 시 에스컬레이션
3. **코드-문서 동기화** — 3중 방어 (프롬프트 + PreToolUse 훅 + 리뷰어)
4. **Anti-Rationalization** — 모든 스킬에 변명-반론 테이블 내장

## 📚 문서

- [하네스 엔지니어링 가이드](docs/setup-guide.md) — `/setup` 실행 시 참고하는 전체 설계 명세
- [킥오프 프롬프트 모음](docs/start-prompts.md) — `/start` 및 상황별 프롬프트

## 🛠 개발

```bash
# 플러그인 수정 후 재로드
/reload-plugins
```

## 📝 라이선스

MIT
