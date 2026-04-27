# i18n

English is the source of truth. Claude Code loads `commands/` and `agents/` from
the repository root — those files are the English masters and the only versions
the runtime ever reads.

`docs/i18n/ko/` holds a frozen snapshot of the pre-F-041 Korean prose. It is
**not synced** with the masters. Treat it as out-of-date the moment any English
file changes; use it as a translation reference, not as documentation.

If you want the plugin to *speak* Korean at runtime — labels like `상태:` /
`근거: N 개` in `work.py` and dashboard output — set one of:

- `HARNESS_LANG=ko` (env var, highest priority)
- `spec.project.language: ko` (per-project pin)
- system locale `LC_ALL=ko_KR.UTF-8`

That path goes through the runtime catalog at `scripts/ui/messages.py`, which
ships in both English and Korean. The static markdown under `commands/` and
`agents/` stays English regardless of locale — it is the system prompt Claude
Code reads, and a single source keeps the agent fixtures stable.
