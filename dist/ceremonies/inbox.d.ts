/**
 * Q&A file-drop inbox scanner (F-097 port of
 * `scripts/ceremonies/inbox.py`).
 *
 * Scans `.harness/_workspace/questions/` for files matching
 * `F-N--<from>--<to>.md` and returns those with no `## Answer`
 * section — the "open" inbox an orchestrator polls at stage
 * boundaries.
 *
 * @module ceremonies/inbox
 */
/** One scanned question. */
export interface InboxQuestion {
    feature_id: string;
    from_agent: string;
    to_agent: string;
    path: string;
    blocking: boolean;
    has_answer: boolean;
}
/** Returns every matching question file under the harness inbox. */
export declare function scanInbox(harnessDir: string, featureId?: string | null): InboxQuestion[];
/** Returns only questions that have not yet been answered. */
export declare function openQuestions(harnessDir: string, featureId?: string | null): InboxQuestion[];
//# sourceMappingURL=inbox.d.ts.map