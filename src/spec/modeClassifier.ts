/**
 * `/harness:spec` mode classifier — A/B/R/E auto-routing (F-090 port
 * of `scripts/spec/mode_classifier.py`, F-002 in spec).
 *
 * Determinism:
 *
 *   - Same inputs → same {@link Mode} every time.
 *   - F-002 acceptance criteria depend on this property; never wire
 *     external state, randomness, or wall-clock checks here.
 *
 * Priority order (matches `commands/spec.md`):
 *
 *   1. Explicit `--mode X` (any value not in A/B/R/E throws).
 *   2. `--explain` flag or explain-shaped intent.
 *   3. spec missing + `.md` argument → Mode B (subtype baseline-from-plan).
 *   4. spec missing + sparse intent (1–39 words) → Mode B (subtype
 *      baseline-empty-vague).
 *   5. spec missing + everything else → Mode B (subtype baseline-empty).
 *   6. spec exists + addition-shaped intent → Mode A.
 *   7. spec exists + everything else → Mode R (default refine).
 *
 * @module spec/modeClassifier
 */

/** The four routing modes the slash command can dispatch into. */
export const Mode = {
  ADDITION: 'A',
  BASELINE: 'B',
  REFINE: 'R',
  EXPLAIN: 'E',
} as const;

/** Type-level alias for {@link Mode} values. */
export type Mode = (typeof Mode)[keyof typeof Mode];

/** Result of one classification call. */
export interface ClassifyResult {
  mode: Mode;
  rationale: string;
  /** Optional fine-grained branch identifier (e.g. `'baseline-empty-vague'`). */
  subtype: string;
  args: ReadonlyArray<string>;
}

/** Optional input shape for {@link classify}. */
export interface ClassifyOptions {
  args?: ReadonlyArray<string>;
  specExists?: boolean;
  intentText?: string;
}

// Heuristics — kept loose so neither English nor Korean intent gets
// disproportionately favoured. \b semantics differ across alphabets,
// so we do not anchor on word boundaries.
const ADDITION_HINTS =
  /(추가|신규 피처|새 엔티티|\badd\b|\bappend\b|\binsert\b|\badd feature\b|\bnew entity\b)/i;
const EXPLAIN_HINTS = /(설명|요약|\bexplain\b|\bshow\b|\bdescribe\b|\bsummary\b)/i;

const VALID_MODE_VALUES = new Set<string>(Object.values(Mode));

/**
 * Returns the mode + rationale for a given slash-command invocation.
 *
 * @throws when `--mode <value>` carries something other than A/B/R/E.
 */
export function classify(options: ClassifyOptions = {}): ClassifyResult {
  const args = [...(options.args ?? [])];
  const specExists = options.specExists ?? false;
  const intentText = options.intentText ?? '';
  const norm = `${args.join(' ')} ${intentText}`;

  // 1. Explicit --mode wins outright.
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && i + 1 < args.length) {
      const val = args[i + 1]!.toUpperCase();
      if (!VALID_MODE_VALUES.has(val)) {
        throw new Error(`unknown --mode value: ${args[i + 1]} (expected A/B/R/E)`);
      }
      return {
        mode: val as Mode,
        rationale: `explicit --mode ${val}`,
        subtype: '',
        args,
      };
    }
  }

  // 2. --explain flag or explain-shaped intent.
  if (args.includes('--explain') || EXPLAIN_HINTS.test(norm)) {
    return {
      mode: Mode.EXPLAIN,
      rationale: 'explain flag or intent',
      subtype: '',
      args,
    };
  }

  // Detect a `.md` / `.markdown` plan-file argument (skipping flags).
  let planCandidate: string | null = null;
  for (const a of args) {
    if (a.startsWith('--')) {
      continue;
    }
    const lower = a.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      planCandidate = a;
      break;
    }
  }

  // 3-5. Spec missing branches.
  if (!specExists) {
    if (planCandidate !== null) {
      return {
        mode: Mode.BASELINE,
        rationale: `spec missing; plan.md 인자 감지 (${planCandidate})`,
        subtype: 'baseline-from-plan',
        args,
      };
    }
    const wordCount = countWords(intentText);
    if (wordCount > 0 && wordCount < 40) {
      return {
        mode: Mode.BASELINE,
        rationale: `spec missing; 빈약 intent (${wordCount} words < 40) → researcher`,
        subtype: 'baseline-empty-vague',
        args,
      };
    }
    return {
      mode: Mode.BASELINE,
      rationale: 'spec missing; 대화형 empty baseline',
      subtype: 'baseline-empty',
      args,
    };
  }

  // 6. spec exists + addition signal.
  if (ADDITION_HINTS.test(norm)) {
    return {
      mode: Mode.ADDITION,
      rationale: 'spec 존재 · addition 의도 감지',
      subtype: '',
      args,
    };
  }

  // 7. Default — refine.
  return {
    mode: Mode.REFINE,
    rationale: 'spec 존재 · 기본 분기 (refine)',
    subtype: '',
    args,
  };
}

/** Whitespace-split word count, mirroring Python's `str.split()`. */
function countWords(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  const tokens = text.trim().split(/\s+/);
  if (tokens.length === 1 && tokens[0] === '') {
    return 0;
  }
  return tokens.length;
}
