# docs/assets/ — README portfolio assets

이 디렉터리는 메인 `README.md` 의 *Built with harness-boot* 섹션이 참조하는 GIF / 스크린샷 자산 보관소입니다.

## 추가 가이드

| 파일명 | 용도 |
|---|---|
| `cosmic-suika.png` | 첫 외부 dogfood 프로젝트 preview 스크린샷 |
| `<your-project>.gif` | 사용자가 harness-boot 로 만든 결과물 — PR 또는 issue 로 추가 가능 |

## 권장 형식

- **GIF**: 1~3 초, ≤ 5 MB, 800px 이하 너비
- **스크린샷**: PNG / WEBP, ≤ 1 MB, retina 권장 시 `@2x` 접미사

## 추가 방법

```bash
# 1. GIF 또는 스크린샷을 이 디렉터리에 복사
cp ~/recording.gif docs/assets/your-project.gif

# 2. README.md 의 §Built with harness-boot 섹션에 한 줄 추가
#    또는 PR / issue 로 보내면 메인테이너가 추가
```

이 디렉터리에 추가된 모든 자산은 메인 README 에서 자동으로 노출됩니다.
