# Response Writing Rules

Plugin-level conventions for how Claude (or any LLM coordinated by harness-boot) **writes** answers, plans, evaluations, and project artifacts (commits, PRs, CHANGELOG).

This file is the single source of truth. `docs/templates/starter/CLAUDE.md.template` and every `agents/*.md` link here. When in doubt, this file wins.

The rules are written once in English; each rule generalises to whichever natural language the user is writing in (Family 2 covers that explicitly).

---

## Family 1 — Answer-first, scannable, brief

1. **Conclusion first.** The answer goes in the first line or first paragraph. Background, reasoning, and caveats follow. Never bury the conclusion under preamble.
2. **Short paragraphs, headings, tables.** Break long explanations into scannable chunks. The reader should locate the key fact within ~5 seconds.
3. **Define jargon only where it actually helps.** First mention of an acronym or project-specific term gets one short gloss. Do not gloss every term — that becomes its own noise. Skip the gloss when the term is in the user's own message or is universally known.
4. **State, don't hedge.** Use direct language ("X works", "Y is required", "I recommend Z"). Reserve hedging ("it appears that…", "it might be that…") for genuine uncertainty.
5. **Same shape for plans, evaluations, and reports.** Code comments and machine-readable schema descriptions are exempt — there, brevity and precision win.
6. **Progress-ID surface discipline.** Do not list handled / in-flight feature IDs (`F-NNN`) in routine responses. They sit in `state.yaml` and PR pages; restating them is noise. Surface them only when the user asks ("show progress", "what's in flight"), and even then summarise — one line per ID, status + one-phrase descriptor, max ten lines total. Same applies to PR numbers and commit hashes: cite only the one currently relevant, not the recent batch.
7. **Brevity for write surfaces — CHANGELOG, commit messages, PR bodies.** Same answer-first + scannable principles apply.
   - **CHANGELOG**: one short paragraph per entry. Lead with the change, then a single sentence on motivation, then any breaking-change note. Skip lists of acceptance criteria, file paths, and test counts — those live in the PR.
   - **Commit message**: subject line ≤ 70 chars, imperative mood. Body (if any) explains *why* the change matters in 2–4 short paragraphs, not *what files changed* (that is the diff).
   - **PR body**: lead with one paragraph stating the change. Use a "Summary" bullet list (3–5 items max) and a short "Test plan" checklist. Skip multi-paragraph rationale, diff narration, and "out of scope" essays — link to the plan or spec entry instead.

---

## Family 2 — Native tone for any user language

Applies to **every natural language a user might write in** — English, Korean (한국어), Japanese (日本語), Chinese (中文), Spanish (Español), German (Deutsch), French (Français), Portuguese (Português), and any other. The rules below describe the principle once; apply the same idea to whichever language the user picked.

1. **Auto-detect the user's language and reply in it.** If the user wrote in Spanish, answer in Spanish. If they mixed languages, pick the dominant one (or English if truly mixed).
2. **No translation tone.** Do not translate from English (or any one language) word-by-word. Write in the syntax, register, and idiom that a native speaker of the target language would use *from the start*.
3. **Zero character / grammar errors.** No broken glyphs, wrong endings, mismatched particles, wrong tense or gender agreement. Self-review before sending.
4. **Keep proper nouns and technical identifiers verbatim.** `spec.yaml`, `gate_5`, `F-132`, harness-boot — these stay original regardless of response language. Don't force-localise them.
5. **Use loanwords as that language's IT community actually uses them.** Don't force-purify, don't force-translate. Native IT-document register is the target. Examples by language: Korean "컨텍스트 / 캐시 / 디버깅", Japanese 「コンテキスト / キャッシュ / デバッグ」, Chinese (Simplified) "上下文 / 缓存 / 调试", Spanish "contexto / caché / depuración", German "Kontext / Cache / Debugging", French "contexte / cache / débogage", Portuguese "contexto / cache / depuração".
6. **Per-language reference patterns** (apply the same idea to any other language):
   - **Korean** — Korean-native word order. End with `-습니다` / `-합니다` / `-요` as the user's register suggests. Don't preserve English subject-verb-object at the cost of natural Korean flow.
   - **Japanese** — Use です / ます / だ・である appropriately for the register. Avoid Korean-syntax loaned word order. Loanwords in katakana.
   - **Chinese** — Don't direct-translate English of/in constructions. Use 把 / 被 / 的 naturally. Match the register (书面语 vs 口语) the user used.
   - **Spanish** — Honour noun gender and number agreement. Natural Spanish word order. Pick formal (usted) vs informal (tú) based on the user's register.
   - **German** — Compound nouns where natural; honour case agreement. Verb position (V2 in main clauses, end-of-clause in subordinate).
   - **French** — Mind gender, accents, and the formal vs informal address (vous vs tu) the user used.
   - **Portuguese** — Distinguish Brazilian vs European Portuguese only when the user signals one. Otherwise default to the user's apparent register.
7. **Model-capability caveat.** Smaller or older LLM models sometimes produce weaker non-English native tone. The rule still applies; release notes recommend Claude Opus / Sonnet 4.x or newer for the best results in non-English languages.

---

## Where these rules apply

| Surface | Apply? | Note |
|---|---|---|
| Plans (the file edited in plan mode) | ✅ | Family 1 directly; Family 2 if user wrote in non-English. |
| In-conversation answers (text outside tool calls) | ✅ | Both families always. |
| Subagent reports back to the orchestrator | ✅ | Same as above. |
| Commit messages, PR titles/bodies | ✅ | English (repo policy) + Family 1 brevity. Rule 7 is the explicit standard. |
| CHANGELOG entries | ✅ | English + Family 1 brevity. Rule 7 is explicit. |
| Code comments, JSDoc, schema descriptions | English, brevity-first | Machine-readable surfaces — exempt from Family 1 prose rules; precision wins. |
| `.harness/_workspace/*.md` ceremony files | Mixed | Match the file's existing voice; both families apply within the chosen language. |

---

## Conflict resolution

If "answer-first" forces an awkward sentence in the user's native language, prioritise **native flow** (Family 2) over the *literal positioning* (Family 1) — but still surface the conclusion in the **first paragraph**. The rules are about reader experience, not about counting words.

---

## Maintenance

- Single SSoT — never duplicate this content elsewhere. Other surfaces (`CLAUDE.md.template`, `agents/*.md`) link here; they don't restate.
- When adding a new reference language, append it to Family 2 with one-line guidance. Don't reorder existing entries.
- Code-side validation: `tests/parity/communicationRules.test.ts` checks file presence + required headings + downstream links.
