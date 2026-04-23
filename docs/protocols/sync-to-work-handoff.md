---
protocol_id: sync-to-work-handoff
version: "1"
direction: "sync -> work"
status: stable
fields:
  - name: spec_hash
    type: string
    required: true
  - name: merkle_root
    type: string
    required: true
  - name: derived
    type: array<string>
    required: true
  - name: plugin_version
    type: string
    required: true
---

# sync-to-work-handoff

`/harness:sync` Phase 0 완료 후 `/harness:work` 나 `/harness:check` 가 **spec 상태 확정 여부**를 확인할 때 사용.

## 전송 트리거

`scripts/sync.py` 가 Phase 0 완료 시 `.harness/events.log` 에 `sync_completed` 이벤트를 append. 이 이벤트가 곧 이 프로토콜의 페이로드.

## 소비자 측 계약

`scripts/work.py` · `scripts/check.py` 는:

1. **spec_hash** 를 `harness.yaml.generation.generated_from.spec_hash` 와 비교 → 불일치 시 "spec drift · sync 필요" 반환
2. **merkle_root** 를 로컬 재계산 (`canonical_hash.compute`) 과 비교 → 검증 실패 시 `sync_failed` 이벤트 append 권장
3. **derived** 목록에 포함된 파일이 실제 존재하는지 확인 → 부재 시 "derived drift" 반환
4. **plugin_version** 은 events.log 의 모든 엔트리에 포함되므로 시간대별 플러그인 버전 추적 가능

## 버전 정책

v1 (현재):
- 위 4 필드 stable
- 추가 optional 필드는 non-breaking (subtrees, skipped, dry_run 등이 이미 optional 로 포함됨)

v2 전환 조건 (breaking 필요 시):
- 필수 필드 이름 변경 또는 의미 재정의
- 전환 시 `docs/protocols/sync-to-work-handoff_v2.md` 신규 작성, v1 은 deprecated 로 변경 후 2 minor 릴리즈 유지

## 예시 페이로드

```json
{
  "ts": "2026-04-23T10:10:37Z",
  "type": "sync_completed",
  "plugin_version": "0.3.12",
  "phase": "0",
  "spec_hash": "8446644a4381e996b4c4c60ef7c3d33877b868e85afe35d068a32dd52f60293e",
  "merkle_root": "3e0fdc5997abf12fa565126ae9732478d646f40b59eff3fda1ba5d13f4da2982",
  "derived": ["domain.md", "architecture.yaml"],
  "skipped": [],
  "dry_run": false
}
```

## 실 레퍼런스

- 쓰기 측 구현: `scripts/sync.py._append_event(..., type="sync_completed")`
- 읽기 측 구현: `scripts/check.py.check_derived()` + `scripts/status.py._last_sync()`
