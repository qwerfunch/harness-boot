// harness-boot — append-only 이벤트 로그 인터페이스 (F-004 최소 스텁)
//
// F-013 에서 파일 백엔드 (10 MB 또는 90 일 로테이션 + sha256 체인 해시) 로
// 확장된다.  F-004 는 인터페이스와 인메모리 구현만 제공한다.

export interface EventLogEntry {
  readonly ts: string; // ISO 8601
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventLog {
  append(entry: EventLogEntry): Promise<void>;
}

export class InMemoryEventLog implements EventLog {
  readonly entries: EventLogEntry[] = [];

  async append(entry: EventLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}
