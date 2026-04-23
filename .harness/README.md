# `.harness/` — harness-boot 자체 도그푸드 (DEV ONLY)

이 디렉터리는 **harness-boot 플러그인 개발자가 자기 자신을 관측**하기 위한 내부 상태입니다. **사용자 프로젝트의 스펙이 아닙니다.**

## 사용자 안내

- **사용자 프로젝트의 `.harness/`**: `/harness:init` 으로 **사용자 자신의 cwd** 에 생성되는 것. 이 파일이 아님.
- **이 `.harness/`**: harness-boot 리포지터리 루트의 dev-only 관측 공간. 플러그인 설치 시 사용자 기기에 함께 복사되지만 `/harness:*` 명령은 이 경로를 **절대 참조하지 않음** (항상 `$(pwd)/.harness` 만 본다).

## SSoT

- `spec.yaml` = `docs/samples/harness-boot-self/spec.yaml` 의 **복사본**. 원본은 후자.
- 편집은 `docs/samples/harness-boot-self/spec.yaml` 에만. `scripts/self_check.sh` 의 `diff -q` 가 동기성을 강제.
- `state.yaml` = v0.3.9 기준 seed. **릴리즈 태그 시점에만** status 전이 기록 (/plugin upgrade 노이즈 최소화).
- `events.log` · `harness.yaml` · `domain.md` · `architecture.yaml` = gitignored (derived · ephemeral).

## 검증

```
bash scripts/self_check.sh
```

5 단계 (diff → validate_spec → sync --dry-run → check → commands/*.md 규약 grep) 통과 시 exit 0.
