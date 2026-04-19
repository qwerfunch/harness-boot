---
name: context-engineering
description: >
  Manages the agent's reading budget. Loads only files needed for the
  current step, uses progressive disclosure (metadata → instructions →
  references), and defers resource loading until an explicit reference
  fires. Prevents "read every file to understand the codebase" patterns
  that burn context without improving answers.
  TRIGGER when: session start, task hand-off, new feature selection, or any
  point where the agent's file-open count exceeds what the current step
  actually needs.
  DO NOT TRIGGER when: the agent already has a tightly scoped question
  against a known file path — just read the file.
metadata:
  author: harness-boot
  version: "1.0"
  category: infrastructure
allowed-tools: "Read Glob Grep"
---
# Context Engineering

## Overview
Context is a budget, not free storage. This skill orders reading so the
agent loads the narrowest file set that answers the current step, then
expands only when an answer is missing — not preemptively.

## When to Use
- **Trigger**: Session start (bootstrap), orchestrator task hand-off to an
  implementer, a `/start` mode switch (Initializer ↔ Coding), or any moment
  the agent is about to open more than ~5 files in a single step.
- **Not when**: Target file is already known and the question is narrow
  enough to answer by reading that file — just do the read.
- **Related skills**: `new-feature` (uses this skill at Step 1 for feature
  context load), `bug-fix` (uses this skill to scope the reproduction
  surface).

## TDD Focus
- N/A — this is a meta-skill about reading, not a code-producing skill.
  It has no `tdd_focus` and adds no test artifacts.

## Process
### Step 1: Identify the current question
State the question in one sentence. "What files does this feature touch?"
is a valid question; "understand the codebase" is not.

### Step 2: Pick the smallest lookup that answers it
In order of preference:
1. **Name/path lookup**: `Glob` or `Grep` for the symbol or filename.
2. **Metadata**: Frontmatter / index / `INDEX.md` entry, if present.
3. **Targeted `Read`**: The specific file whose metadata suggested relevance.
4. **Expand**: Load related files ONLY when the current answer pointed to them.

Stop at the first step that answers the question. Do not "also check" other
files defensively.

### Step 3: Record what you found
When the task spans multiple steps, write a one-line note in
`_workspace/{phase}_{agent}_{artifact}.md` summarising the answer so the
next step doesn't re-open the same files.

### Step 4: Release what you don't need
If the current step ends and the next step is distinct (e.g., moving from
"pick a feature" to "implement a feature"), do not carry file contents
forward — each step re-queries only what it needs.

### Step 5: Watch the budget
If file-open count in a single step exceeds ~10 without answering the
question, the question is too broad. Return to Step 1 and split it.

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "I'll read the whole directory first so I understand the structure" | Structure is answered by `ls` and `Glob`, not by opening every file. Opening files you won't cite in the answer is pure context spend with no information gain. |
| "One more file, just in case" | "Just in case" is how context budgets collapse. If you cannot name the specific question the next file answers, do not open it. |
| "Holding the full file content in context is fine, I might need it later" | Later is another step, and that step re-queries. Releasing is the default; carrying is the exception, justified only by an immediate next read. |
| "Grep is too narrow; I'll just read the file" | Grep first, then read the matches. Reading whole files to find one symbol is a common-but-expensive anti-pattern. |

## Red Flags
- `Read` calls outnumber `Grep`/`Glob` calls in a single step by more than 3:1
- Files opened whose paths never appear in the step's output
- A later step re-reads a file the previous step already read without writing a `_workspace/` note
- Agent reports "I read everything in `src/`" as a progress update (symptom: breadth before depth)

## Verification
- [ ] Step's question stated in one sentence (evidence: `_workspace/` note or visible reasoning)
- [ ] Files opened each cited in the step's output (evidence: log of tool calls vs. answer)
- [ ] No more than 10 `Read` calls per step without a fresh question (evidence: tool call log)
- [ ] Progressive disclosure respected: metadata scanned before full read (evidence: order of tool calls)
