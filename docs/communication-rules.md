# Response Writing Rules / 응답 작성 규칙

> Plugin-level conventions for how Claude (or any LLM coordinated by harness-boot) **writes** answers. Two rule families: (1) **answer-first / scannable format**, (2) **native-tone for any user language**.
>
> harness-boot 가 조율하는 LLM 응답이 **어떻게 쓰일지** 를 정한 plugin 차원의 규칙. 두 갈래: (1) **결론 먼저 + 빠르게 훑는 형식**, (2) **사용자 언어의 네이티브 톤** (한국어뿐 아니라 모든 자연어).
>
> Single source of truth. Linked from `docs/templates/starter/CLAUDE.md.template` and from every `agents/*.md`. When in doubt, this file wins.

---

## Family 1 — Answer-first, scannable format

### English

1. **Conclusion first.** The answer goes in the first line or first paragraph. Background, reasoning, and caveats follow. The reader should see the answer before deciding whether to read the rest.
2. **Short paragraphs, headings, and tables.** Break long explanations into scannable chunks. The reader should locate the key fact within ~5 seconds.
3. **Define jargon on first mention.** Acronyms and project-specific terms get one short gloss the first time they appear in a response. Never assume the reader has read the whole codebase.
4. **State, don't hedge.** Use direct language ("X works", "Y is required", "I recommend Z"). Reserve hedging ("it appears that…", "it might be that…") for genuine uncertainty.
5. **Plans, evaluations, and reports follow the same shape.** Code comments and machine-readable schema descriptions are exempt — there, brevity and precision win.
6. **Lead with the bottom line, support with detail.** A one-line summary, then the table or list, then the deeper analysis. Never bury the conclusion under preamble.

### 한국어

1. **결론 먼저.** 답을 첫 줄 또는 첫 문단에 직접 놓는다. 배경 설명·근거·단서는 그 뒤. 독자가 답을 본 다음 나머지를 읽을지 고를 수 있어야 한다.
2. **짧은 문단·헤딩·표.** 긴 설명을 한 덩어리로 늘어놓지 않는다. 독자가 5초 안에 핵심을 찾을 수 있어야 한다.
3. **전문 용어는 처음 등장 시 한 번 풀어 쓰기.** 약어·프로젝트 고유 용어는 처음 나올 때 한 줄 설명을 붙인다. 독자가 코드베이스 전체를 읽었다고 가정하지 않는다.
4. **단정형으로 답한다.** "X 동작합니다 / Y 가 필요합니다 / Z 를 권장합니다" 식으로. "검토해 보면 …같이 보입니다" 같은 hedge 는 정말 불확실할 때만.
5. **plan · 평가 · 보고서 모두 동일 형식.** 코드 주석이나 schema description 같은 기계 가독 영역은 예외 — 거기선 간결·정확이 우선.
6. **요점 먼저, 디테일은 뒤.** 한 줄 결론 → 표/목록 → 깊은 분석 순. 결론을 서론 밑에 묻지 않는다.

---

## Family 2 — Native tone for any user language

> Applies to **every natural language a user might write in**: English, Korean (한국어), Japanese (日本語), Chinese (中文), Spanish (Español), German (Deutsch), French (Français), Portuguese (Português), and others. Reference patterns below name a few of the most-used non-English languages, but the rule generalises.

### English

1. **Auto-detect the user's language and reply in it.** If the user wrote in Spanish, answer in Spanish. If they mixed languages, pick the dominant one (or English if truly mixed).
2. **No translation tone.** Do not translate from English (or any one language) word-by-word into the target. Write in the syntax, register, and idiom that a native speaker of the target language would use *from the start*.
3. **Zero character / grammar errors.** No broken glyphs, wrong endings, mismatched particles, or wrong tense. Self-review before sending.
4. **Keep proper nouns and technical identifiers in original form.** `spec.yaml`, `gate_5`, `F-132`, harness-boot, and similar terms stay verbatim regardless of the response language. Don't force-localise them.
5. **Use loanwords as that language's IT community actually uses them.** Don't force-purify. Examples of common forms by language:
   - Korean — "컨텍스트", "캐시", "디버깅"
   - Japanese — 「コンテキスト」「キャッシュ」「デバッグ」
   - Chinese (Simplified) — "上下文", "缓存", "调试"
   - Spanish — "contexto", "caché", "depuración"
   - German — "Kontext", "Cache", "Debugging"
   - French — "contexte", "cache", "débogage"
   - Portuguese — "contexto", "cache", "depuração"
6. **Per-language reference patterns** (apply the same idea to any other language):
   - **Korean** — Korean-native word order. End with `-습니다` / `-합니다` / `-요` appropriately. Do not preserve English subject-verb-object order at the cost of natural Korean flow.
   - **Japanese** — Use です / ます / だ・である appropriately for the register. Avoid Korean-syntax loaned word order. Loanwords in katakana.
   - **Chinese** — Don't direct-translate English of/in constructions. Use 把 / 被 / 的 naturally. Match the register (书面语 vs 口语) the user used.
   - **Spanish** — Honour noun gender and number agreement. Use natural Spanish word order, not the English template. Pick formal (usted) vs informal (tú) based on the user's register.
   - **German** — Compound nouns where natural; honour case agreement. Mind verb position (V2 in main clauses, end-of-clause in subordinate).
   - **French** — Mind gender agreement, accent marks, and the formal vs informal address (vous vs tu) the user used.
   - **Portuguese** — Distinguish Brazilian vs European Portuguese only when the user signals one. Otherwise default to the user's apparent register.
7. **Model-capability caveat.** Smaller or older LLM models sometimes produce weaker non-English native tone. The rule still applies; release notes recommend Claude Opus / Sonnet 4.x or newer for the best results in non-English languages.

### 한국어

1. **사용자 언어를 자동 인식해 같은 언어로 답한다.** 사용자가 스페인어로 쓰면 스페인어로, 한국어로 쓰면 한국어로. 다국어가 섞여 있으면 비중이 큰 쪽 (또는 영어) 으로.
2. **번역톤 금지.** 영어 (또는 어느 한 언어) 를 단어 단위로 옮긴 어순·관용표현을 쓰지 않는다. 처음부터 그 언어 화자가 자연스럽게 쓰는 어순·종결형·관용 패턴으로 작성.
3. **문자·문법 오류 0.** 깨진 글자, 부적절한 종결, 어색한 조사·시제 0. 보내기 전에 스스로 검토.
4. **고유명사·기술 식별자는 원형 유지.** `spec.yaml`, `gate_5`, `F-132`, harness-boot 같은 용어는 어떤 언어로 답하든 원형 그대로. 무리한 현지화 금지.
5. **외래어는 그 언어의 IT 커뮤니티에서 통상적인 형태로.** 강제 순화 금지. 위 영문 항목 5번에 언어별 예시.
6. **언어별 참고 패턴** (다른 언어에도 동일 원칙):
   - **한국어** — 한국어 자연 어순. `-습니다 / -합니다 / -요` 적절히. 영어 SVO 를 무리해서 보존하느라 한국어 흐름이 깨지면 안 됨.
   - **일본어** — です / ます / だ・である 의 격을 맞춤. 한국어 어순 차용 금지. 외래어는 가타카나로.
   - **중국어** — 영어 of/in 구조를 直譯 X. 把 / 被 / 的 등 자연 구문. 사용자가 쓴 register (书面语 vs 口语) 에 맞춤.
   - **스페인어** — 명사 성·수 일치. 영어 템플릿이 아닌 스페인어 자연 어순. usted (격식) vs tú (비격식) 는 사용자 register 따라.
   - **독일어** — 자연스러운 곳에는 합성명사 사용. 격 일치. 동사 위치 (주절 V2, 종속절 끝) 주의.
   - **프랑스어** — 성·수 일치, 악센트, vous vs tu 격식 — 사용자 register 따라.
   - **포르투갈어** — 사용자가 신호하지 않는 한 브라질 vs 유럽 포르투갈어 구분 X. 기본은 사용자의 register 따라.
7. **모델 한계 명시.** 작은 모델 / 옛 모델은 비주류 언어의 네이티브성이 떨어진다. 규칙은 강제 항목이지만, release notes 에서 Claude Opus / Sonnet 4.x 이상의 권장 모델을 명시한다.

---

## Where these rules apply

| Surface | Apply? | Note |
|---|---|---|
| Plans (the file edited in plan mode) | ✅ | Family 1 directly; Family 2 if user wrote in non-English. |
| In-conversation answers (text outside tool calls) | ✅ | Both families always. |
| Subagent reports back to the orchestrator | ✅ | Same as above. |
| Commit messages, PR titles/bodies | English only by repo policy | Family 1 still applies (answer first). |
| Code comments, JSDoc, schema descriptions | English, brevity-first | These are machine-readable surfaces — exempt from Family 1's "scannable" prose; precision wins. |
| CHANGELOG entries | English | Family 1 applies (lead with the change, then context). |
| `.harness/_workspace/*.md` ceremony files | Mixed | Match the file's existing voice (kickoff/retro often run in Korean); both families apply within the chosen language. |

---

## When these rules conflict with each other

If "answer-first" forces an awkward sentence in the user's native language, prioritise **native flow** of Family 2 over the *literal positioning* of Family 1 — but still surface the conclusion in the **first paragraph**. The rules are about reader experience, not about counting words.

---

## Maintenance

- Single SSoT — never duplicate this content elsewhere. Other surfaces (`CLAUDE.md.template`, `agents/*.md`) link here; they don't restate.
- When adding a new reference language, append it to Family 2's list with one-line guidance. Don't reorder existing entries.
- Code-side validation: `tests/parity/communicationRules.test.ts` checks that this file exists with required headings and that downstream surfaces link to it correctly.
