// harness-boot — 점-경로(JSON path) get/set 유틸 (F-008)
//
// 복잡한 포인터 라이브러리를 피하고 `a.b.c` 형태 경로만 지원한다.  배열
// 인덱싱이 필요해지면 확장한다.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function getPath(root: unknown, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = root;
  for (const part of parts) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

export function setPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split('.');
  const out: Record<string, unknown> = { ...root };
  let cursor: Record<string, unknown> = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    const next = cursor[key];
    const cloned: Record<string, unknown> = isRecord(next) ? { ...next } : {};
    cursor[key] = cloned;
    cursor = cloned;
  }
  cursor[parts[parts.length - 1] as string] = value;
  return out;
}

export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}
