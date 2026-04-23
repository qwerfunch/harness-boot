// harness-boot — module 이름 유사도 검증 (F-006)
//
// 설계 §5.1 규칙 — Levenshtein ≤ 2 **AND** 편집 비율(distance / max length)
// ≤ 0.34 를 동시에 만족하면 "유사" 로 보고 warning 을 발생시킨다.  짧은 이름
// 이 과도하게 플래그되지 않도록 비율 조건이 안전망 역할을 한다.

const MAX_DISTANCE = 2;
const MAX_RATIO = 0.34;

export interface SimilarPair {
  a: string;
  b: string;
  distance: number;
  ratio: number;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}

export function findSimilarModulePairs(
  modules: readonly string[],
): SimilarPair[] {
  const out: SimilarPair[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const a = modules[i] as string;
      const b = modules[j] as string;
      if (a === b) continue;
      const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const distance = levenshtein(a, b);
      if (distance === 0 || distance > MAX_DISTANCE) continue;
      const ratio = distance / Math.max(a.length, b.length);
      if (ratio > MAX_RATIO) continue;
      out.push({ a, b, distance, ratio });
    }
  }
  return out;
}
