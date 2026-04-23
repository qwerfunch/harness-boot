// harness-boot — /harness:analyze 상태 · 옵션 타입 (F-007)
//
// 3-way + idempotent 네 상태로 현재 `.harness/` 를 분류한다.  모든 쓰기는
// writeSkeleton 이 담당하고, 탐지는 순수하게 검사만 한다.

export type AnalyzeState =
  | { kind: 'missing' }
  | { kind: 'partial'; missingFiles: readonly string[] }
  | {
      kind: 'new_input';
      previousHash: string | undefined;
      currentHash: string;
    }
  | { kind: 'idempotent'; hash: string };

export interface AnalyzeOptions {
  cwd: string;
  specSource: string;
  now?: () => Date;
}

export interface AnalyzeResult {
  state: AnalyzeState;
  writtenFiles: readonly string[];
  backupPath?: string;
}

export const HARNESS_DIR = '.harness';

// 스켈레톤의 필수 파일 — "partial" 판정은 이 중 하나라도 빠지면 발생한다.
// hooks 디렉토리는 meta.json 으로 대표되며, 빈 events.log 도 요구한다.
export const REQUIRED_FILES: readonly string[] = [
  'spec.yaml',
  'harness.yaml',
  'state.yaml',
  'events.log',
  'hooks/meta.json',
] as const;
