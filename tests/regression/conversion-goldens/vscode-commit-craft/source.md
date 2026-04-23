# vscode-commit-craft — Git 커밋 메시지 작성 지원 확장 기획

**대상 형태**: VSCode extension (VS Marketplace 배포 `vscode-commit-craft`)
**주요 소비자**: VSCode 로 git 레포를 다루는 개인·팀 개발자
**호스트**: VSCode 1.80+ (Cursor / VSCodium 호환 best-effort)

## 1. 배경

커밋 메시지 품질은 팀 문화에 큰 영향을 주지만 실제 작성 현장에서는
(a) 스테이징된 변경을 보며 메시지를 즉석에서 쓰거나 (b) 습관적으로
`fix`, `wip` 로 넘어가는 경우가 대부분이다. 기존 도구들:

- **commitizen** · **commitlint**: 훌륭하지만 터미널 기반 — IDE 컨텍스트
  바깥. 훅이 실패해야 학습 피드백이 생김.
- **GitLens**: 커밋 탐색·blame 에 강점. 메시지 "작성" 자체를 돕는 기능은 제한.
- **VSCode 내장 SCM**: 자유 입력 박스만 제공. 템플릿·힌트 없음.

이 확장은 **"IDE 안에서 커밋 메시지를 작성할 때"** 에 집중한다. 스테이징된
diff + 팀 컨벤션 템플릿 + 최근 커밋 히스토리를 컨텍스트로 삼아, 입력 중인
메시지에 인라인 힌트·자동완성·린트 경고를 제공한다.

## 2. 목표

- **SCM 입력 박스 통합**: VSCode Source Control 탭의 메시지 입력에 인라인
  가이드(최대 타이틀 72자, body 권장, 푸터에 issue 링크) 실시간 표시
- **팀 컨벤션 템플릿**: `.commit-craft/template.yaml` 로 타입(feat/fix/...) ·
  scope · 형식 정의. 드롭다운 + 스니펫으로 제공
- **최근 커밋 기반 autocompletion**: 최근 100 커밋의 scope·type 을 학습하여
  자동완성 소스로 사용 (로컬만, 네트워크 전송 없음)
- **사이드바 뷰**: 활동 표시줄 아이콘 + 트리뷰 (draft 메시지들, 최근 승인된
  템플릿, 팀 규칙)
- **커밋 시도 시 린트**: 규칙 위반 시 blocking 경고(설정으로 warn/fail 선택)
- **LLM 초안 생성 (선택)**: 스테이징 diff 로부터 메시지 초안 생성. 기본 off,
  사용자가 모델 엔드포인트 키 설정 후 활성화

## 3. 비목표 (v1 범위 밖)

- 커밋 **실행** 자체 — VSCode SCM 에 위임. 우리는 메시지 편집 단계만.
- **PR 설명 자동 생성** — 별도 확장 `vscode-pr-craft` (v2 후보)
- Merge commit 메시지 자동화 — git rebase/merge 흐름은 영역 밖
- 서버측 훅 설치 — 클라이언트 전용
- 다중 SCM 제공자 — git 전용, SVN/Mercurial 비지원
- commit signing 관리 — OS keychain · GPG 영역 밖

## 4. 공개 표면(Contribution Points)

### 4.1 명령 (commands, 8 개)

| 명령 ID | 제목 | 활성화 조건 |
|---------|------|-------------|
| `commitCraft.draft.new` | "새 커밋 초안 작성" | SCM 뷰 열림 + 스테이징 ≥ 1 파일 |
| `commitCraft.draft.fromTemplate` | "템플릿에서 초안" | 항상 |
| `commitCraft.draft.fromDiff` | "스테이징 diff 로 LLM 초안" | LLM 활성 |
| `commitCraft.draft.save` | "초안 저장" | 초안 존재 |
| `commitCraft.draft.clear` | "현재 초안 비우기" | 초안 존재 |
| `commitCraft.template.edit` | "템플릿 파일 열기" | 항상 |
| `commitCraft.lint.runNow` | "현재 메시지 린트 검사" | 메시지 박스 non-empty |
| `commitCraft.history.learn` | "최근 커밋 재학습" | 항상 |

### 4.2 키바인딩 (keybindings, 3 개)

| 키 (Linux/Win) | 키 (macOS) | 명령 | 조건 |
|----------------|-----------|------|------|
| `Ctrl+K M` | `Cmd+K M` | `commitCraft.draft.new` | `scmFocused` |
| `Ctrl+K L` | `Cmd+K L` | `commitCraft.lint.runNow` | `scmFocused` |
| `Ctrl+K T` | `Cmd+K T` | `commitCraft.template.edit` | 항상 |

### 4.3 뷰 (views, 2 개)

- **activity bar icon** `commitCraft.view.container` — 독자 활동 표시줄 섹션
- **sidebar tree view** `commitCraft.view.drafts` — 트리 3 루트 노드:
  - "📝 Active drafts" — 저장된 초안 목록
  - "📚 Templates" — 로드된 팀 템플릿 리스트
  - "🕑 Recent commits" — 학습 대상 최근 커밋 (빈도 기반 정렬)

### 4.4 설정 (configuration, 10 개)

| 키 | 타입 | 기본값 | 설명 |
|----|------|--------|------|
| `commitCraft.templatePath` | string | `.commit-craft/template.yaml` | 템플릿 파일 경로 (워크스페이스 상대) |
| `commitCraft.title.maxLength` | number | 72 | 타이틀 최대 길이 |
| `commitCraft.body.required` | boolean | false | 바디 필수 여부 |
| `commitCraft.footer.issueLink.required` | boolean | false | 이슈 링크 필수 여부 |
| `commitCraft.lint.onCommit` | `"warn"|"error"|"off"` | `"warn"` | 커밋 시도 시 린트 레벨 |
| `commitCraft.history.learnCount` | number | 100 | 학습 대상 최근 커밋 수 |
| `commitCraft.history.retainDays` | number | 30 | 학습 캐시 보존일 |
| `commitCraft.llm.enabled` | boolean | false | LLM 초안 생성 활성화 |
| `commitCraft.llm.endpoint` | string | `""` | LLM 엔드포인트 URL |
| `commitCraft.llm.apiKeyRef` | string | `""` | OS keychain 키 이름 |

### 4.5 컨텍스트 메뉴 (menus, 4 위치)

| 위치 | 명령 | 그룹 | 조건 |
|------|------|------|------|
| SCM input box | `commitCraft.draft.new` | `navigation@1` | 스테이징 ≥ 1 |
| SCM input box | `commitCraft.draft.fromTemplate` | `navigation@2` | 항상 |
| Tree item `drafts` | `commitCraft.draft.clear` | `inline` | 선택된 draft |
| Tree item `templates` | `commitCraft.template.edit` | `inline` | 템플릿 선택 |

### 4.6 상태바 (status bar, 1 개)

- `commitCraft.statusBar.lintResult`
  - alignment: right, priority: 100
  - text: 린트 상태 "$(check) craft OK" / "$(warning) 2 hints" / "$(error) 1 err"
  - command: `commitCraft.lint.runNow`

### 4.7 활성화 이벤트 (activationEvents)

- `onView:commitCraft.view.drafts`
- `onCommand:commitCraft.draft.new`
- `workspaceContains:.git` (git 레포만)

## 5. 핵심 엔티티

- **Extension**: 확장 런타임 인스턴스. activate/deactivate lifecycle.
- **Template**: `.commit-craft/template.yaml` 로부터 로드된 팀 컨벤션 객체.
  types[], scopes[], format(title/body/footer pattern).
- **Draft**: 작성 중인 커밋 메시지 상태 + 연관 diff hash.
- **LintRule**: 단일 검증 규칙(title 길이, scope whitelist, body 필수 등).
- **LintVerdict**: `level: ok|hint|warning|error` × message × applied_rule.
- **HistoryIndex**: 최근 커밋 학습 캐시(type/scope 빈도).
- **LLMAdapter**: 엔드포인트 호출 어댑터. 기본 off, 사용자 설정 필요.
- **StatusBarItem**: 상태바 현 상태 래퍼.

## 6. 호환성

| 대상 | 최소 버전 | 비고 |
|------|-----------|------|
| VSCode | 1.80 | `engines.vscode` 선언 |
| Cursor | 0.35+ | best-effort (VSCode API 호환 선) |
| VSCodium | 1.80+ | OSS 빌드에서 동작 확인 |
| Node (host) | 18 | VSCode 내장 런타임 따라감 |
| Git | 2.30+ | `git log --format=%s` 스트림 |

## 7. 배포 / 번들

- 패키지 이름: `commit-craft` (publisher `qwerfunch`)
- Marketplace: VS Marketplace + OpenVSX (두 곳 동시 배포)
- VSIX 빌드: `vsce package` + `ovsx publish`
- 번들: `tsup` → ESM (VSCode 확장 가이드 따름)
- 번들 크기 목표: gz 150kB 이하
- 아이콘: SVG 1종 + PNG 128×128
- `activationEvents` 는 **필요한 것만** 명시 — 최소 활성화

## 8. 버전 정책 (SemVer)

- **major**: Template 스키마 breaking, 최소 VSCode 버전 상승, 명령 ID rename
- **minor**: 새 설정, 새 명령, 새 lint 규칙, 새 컨텍스트 메뉴
- **patch**: 문구, 번역, 내부 리팩터, 성능
- **Template schema version**: 별도 축(`schemaVersion: 1`) — 확장 major 승격
  없이도 schemaVersion 은 올릴 수 있음 (경고 후 migration 지원 1버전)

## 9. 개발 마일스톤

- **M1 (1주)**: 확장 뼈대 + activate/deactivate + SCM 입력 박스 후킹 +
  commitCraft.draft.new 1개 명령 동작
- **M2 (1주)**: Template 로드·파싱(zod) + 타입/스코프 자동완성
- **M3 (1주)**: HistoryIndex 학습 (최근 100 커밋) + 드롭다운 소스 통합
- **M4 (1.5주)**: 트리뷰 + 상태바 + 컨텍스트 메뉴 4위치 전부 연결
- **M5 (1주)**: 린트 엔진 + lint.onCommit 정책 + LintVerdict UI 표시
- **M6 (1주, 선택)**: LLM 어댑터 + diff → 초안 생성 (기본 off)
- **M7 (0.5주)**: 문서 + gif 데모 + 1.0 마켓플레이스 배포

## 10. UX 설계 원칙 (요약)

1. **SCM 입력 박스가 1급 표면** — 사이드바는 부차
2. **키보드 우선** — 3개 키바인딩으로 주요 동선 완결
3. **로컬 우선** — HistoryIndex·Draft 모두 워크스페이스 `.vscode/` 하위
4. **LLM 옵션은 명시적 opt-in** — 기본 off, 설정 2개 필요
5. **팀 템플릿은 레포 일부** — 개인 설정이 아닌 `.commit-craft/` 디렉터리
6. **VSCode API 외 런타임 제한** — Node built-in + 번들 의존만

## 11. 의존성 / 외부

- **런타임**: `zod`, `yaml` (template 파싱), `simple-git` (최근 커밋 학습)
- **개발**: `@types/vscode`, `tsup`, `vitest`, `vsce`, `ovsx`
- **LLM (선택)**: 사용자가 엔드포인트/키 제공. 확장에 번들되는 SDK 없음.

## 12. 리스크 · 미결정

- Cursor/VSCodium 이 VSCode 내부 API 의존 일부를 지원하지 않을 수 있음.
  SCM input box 후킹은 public API 인데 팝업 UI 위치 선호가 다를 수 있음.
- Template schema 가 너무 유연하면 팀마다 해석이 달라짐 — v1 은 엄격 스키마
  + v2 에서 완화 검토
- LLM 기능을 기본 off 로 두어도 사용자가 활성화 시 실수로 API 키 노출 가능.
  OS keychain 사용 강제 + 평문 저장 warn
- 최근 100 커밋 학습이 대형 레포(수십만 커밋)에서 느릴 수 있음 — `git log`
  페이징 + 취소 가능한 토큰
- VSCode 1.90+ 에서 SCM API 변경 예고 — 호환성 모니터링 필요

## 13. 성공 지표

- VS Marketplace 다운로드 **주간 500+** 릴리즈 후 90일 내
- 사내팀 3곳에서 PR 템플릿과 함께 채택
- 평균 커밋 타이틀 길이가 도입 전 대비 ±20% 이내 안정 (품질 일관성)
- 린트 블록으로 인한 "억지 통과(strip rule)" 리포트 월 ≤ 2건

## 14. 이해관계자

- **개인 개발자**: 직접 사용자. UX 의 마찰이 최소여야 함. 키보드 동선 중요.
- **팀 리드 / DevEx**: 템플릿 소유자. 팀 컨벤션을 레포에 기록 + 리뷰 가능한
  형태 선호.
- **플랫폼**: VSCode 버전 매트릭스 유지, Cursor/VSCodium 호환 모니터링.
- **Security/Infra**: LLM 키 관리 감사. 로컬 학습 데이터가 레포 밖으로
  유출되지 않는지 계약 필요.
- **OSS 커뮤니티**: MIT. 템플릿 기여(공개 프리셋) 수용.

## 15. 비포함 (재강조)

- 커밋 실행·PR 생성·서버 훅·멀티 SCM·signing — 모두 v1 영구 비목표
- 원격 LLM API 의 응답 캐시 서버 운영 — 우리는 클라이언트 전용

## 16. 설계 원칙 (요약)

1. "입력 박스에 힌트가 뜬다" 를 차별화 포인트로 유지
2. 팀 템플릿 = 레포 일부. 개인 설정에 의존하지 말 것.
3. 네트워크는 LLM 옵션에서만. 기본 100% 로컬.
4. VSCode API 이외의 host 는 지원하지 않음 (IntelliJ 등은 별 확장).
5. 활성화 이벤트는 필요한 최소 (cold start 성능)

## 17. 부록: 예시 흐름

```
1. 사용자가 파일 3개 스테이징
2. Cmd+K M → "새 커밋 초안 작성"
3. 드롭다운: type=feat · scope=api · 본문 템플릿 삽입
4. 입력 중 상태바 "$(check) craft OK" 유지
5. 타이틀이 80자 초과 → 상태바 "$(warning) 1 hint"
6. 커밋 버튼 → lint.onCommit="warn" 이면 통과 (remind)
7. 커밋 후 HistoryIndex 가 scope=api 빈도 +1
```
