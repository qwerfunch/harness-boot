# Protocols — 에이전트 간 페이로드 규약 (F-017)

## 목적

harness-boot 안에서 에이전트 · 명령 · 훅 간 **JSON 페이로드를 주고받을 때** 사용하는 구조 계약. `"내가 보내는 것 = 네가 받아서 쓸 수 있는 것"` 경계를 공식화한다. 비공식 ad-hoc JSON 키 사용을 금지.

## 위치

| 경로 | 용도 |
|---|---|
| `docs/protocols/` (플러그인 소스) | harness-boot 가 기본 제공하는 프로토콜 라이브러리 · 이 README 에서 설명 |
| 사용자 `.harness/protocols/` | 프로젝트별 커스텀 프로토콜 (init 은 만들지 않음, 필요 시 사용자 생성) · `/harness:check` 가 규약 검증 |

## 파일 형식

각 프로토콜 파일은 YAML frontmatter + markdown 본문 구조.

### 필수 frontmatter

```yaml
---
protocol_id: sync-to-work-handoff    # 파일명 stem 과 반드시 일치 (AC-2)
version: "1"                          # semver major; breaking change 는 protocol_v2 병행
direction: "sync -> work"             # "<sender> -> <receiver>"
status: "stable" | "experimental" | "deprecated"
fields:                                # 페이로드 스키마 요약
  - name: "spec_hash"
    type: "string"
    required: true
  - name: "derived"
    type: "array<string>"
    required: true
---
```

### 본문

- `## 전송 트리거` — 언제 이 프로토콜이 발송되나
- `## 소비자 측 계약` — 수신자는 이 필드를 어떻게 해석하는가
- `## 버전 정책` — breaking change 시 어떻게 전이하는가
- `## 예시 페이로드` — 구체적 JSON 사례

## 버전 정책 (AC-1)

**breaking change 가 생기면 새 파일 `<id>_v2.md` 를 만들고 이전 버전도 유지** — drift 방지 원칙. 기존 소비자는 v1 을 계속 읽고, 신규 소비자는 v2 를 선택. 마이그레이션 완료 후 이전 버전을 `status: deprecated` 로 변경.

**breaking change 기준**:
- 필수 필드 추가/제거
- 필드 타입 변경
- enum 값 제거
- 의미 재정의 (같은 이름, 다른 해석)

**non-breaking**:
- optional 필드 추가
- enum 값 추가
- 설명 텍스트만 변경

## 검증 (AC-2)

`scripts/check.py` 의 **Protocol drift (9 번째 drift 종)** 이 `.harness/protocols/*.md` 각각에 대해:

1. frontmatter 로드 성공
2. `protocol_id` 필드 존재
3. `protocol_id == <파일명 stem>`

셋 중 하나라도 어긋나면 `error` severity finding. `/harness:check --harness-dir .harness` 로 실행.

플러그인 소스의 `docs/protocols/` 는 사용자 데이터가 아니므로 이 check 대상이 **아님**. 플러그인 자체 검증은 harness-boot 기여자 책임.

## 기본 프로토콜 라이브러리

| 파일 | 방향 | 상태 |
|---|---|---|
| [sync-to-work-handoff.md](sync-to-work-handoff.md) | `/harness:sync` → `/harness:work` | stable |

## 확장

새 프로토콜 추가:
1. `docs/protocols/<new-id>.md` 작성 (형식 준수)
2. frontmatter `protocol_id: <new-id>` (파일명과 일치)
3. 본문 4 섹션 채우기
4. 이 README 의 "기본 프로토콜 라이브러리" 표에 한 줄 추가
5. 커밋

사용자가 자기 프로젝트 별 프로토콜을 추가할 때:
1. `.harness/protocols/<id>.md` 작성
2. `/harness:check` 로 검증
