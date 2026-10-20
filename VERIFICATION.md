# Verification status

Last verified: 2026-10-20, branch `feat/validator-and-data`, Windows 11, Node.js v24.19.0, npm 11.17.0.

## Passed (run by the agent, output observed)

- `npm install`: 427 packages added. npm reports 5 high severity advisories, all in devDependencies (`npm audit --omit=dev` reports 0). `npm audit fix --force` was not run.
- `npm run typecheck`: `tsc --noEmit`, exit 0, no errors.
- `npm run lint`: `eslint .`, exit 0, no errors or warnings.
- `npm test`: 22 tests, 22 pass, 0 fail (5 workflow tests, 17 validator and D4 integration tests).
- `npm run build`: Next.js 16.4.0 (Turbopack) production build succeeded; all 7 routes prerendered as static content. The prerendered `/workspace` HTML contains the D4 draft "Candidate precedents (historical, not validated): NCR-2025-084 ..." and "Root cause check: pass".
- `npm run dev` (checked 2026-10-20 before Phase 1 changes): every route (`/`, `/workspace`, `/ncr`, `/capa`, `/knowledge`, `/audit`) returned HTTP 200 and the dev server log showed no errors.

## Not verified

- No browser click testing has been done by the agent. The Claude in Chrome extension was not connected, so saving, approving, generating, the live Root cause check panel, audit events and localStorage persistence have not been exercised in a browser. Use the manual checklist in the Phase 1 report or the README demo walkthrough.
- All AI output is still deterministic synthetic text with a simulated delay. No model, AWS service, authentication or backend is connected.
- The root cause check is syntactic. It does not confirm that a cited evidence id belongs to the current lot.

## Manual browser checklist

Run `npm run dev`, open http://localhost:3000, reset the demo data from the profile menu, then open http://localhost:3000/workspace (NCR-2026-104, D4).

Existing flow
1. D4 editor shows "Candidate precedents (historical, not validated): NCR-2025-084 (...); NCR-2026-019 (...)". Root cause check panel shows "pass".
2. Edit the text, click "Save changes": toast "Section saved. Changes invalidate downstream approvals."
3. Click "Approve" with an empty note, click "Confirm human approval": error "Record validation evidence or a rejection reason."; D4 stays Draft.
4. Approve with note `TR-104: current-lot controlled trial reviewed.`: D4 becomes Approved, D5 unlocks.
5. D5: click "Generate AI suggestion" (about 1.4 s), approve with an empty note (error), then with a note: D5 Approved, D6 unlocks. No Root cause check panel on D5.

Root cause check
6. On D4 (reset first if already approved), clear the editor and type `root cause: human error`: the panel turns to "fail" immediately with GENERIC_CLAIM_UNSUPPORTED, asking for a cited retrieved NCR and a current-lot evidence id.
7. Type `root cause: human error per NCR-2026-032`: CITATION_NOT_RETRIEVED is added (NCR-2026-032 was not retrieved for this case).
8. Type `Operator kurang teliti`: fail with GENERIC_CLAIM_UNSUPPORTED.
9. Type `Human error per NCR-2025-084, confirmed by trial TR-104.`: pass.
10. Type `root cause: human error`, click "Save changes": Agent timeline and Audit Trail show a System event "Root cause check rejected D4 saved draft: GENERIC_CLAIM_UNSUPPORTED." by "Root cause validator".
11. Approve with a note: the dialog shows "Root cause check failed: ...", D4 stays Draft, and a System event "Root cause check rejected D4 approval: GENERIC_CLAIM_UNSUPPORTED." is added.
12. "Request revision" with a reason still works on the failing text.
13. "Generate AI suggestion" restores the draft and the panel shows "pass".
14. Known behavior: approval checks the saved content, not unsaved editor text.
15. Select NCR-2026-100 (no historical cases), open D4: the "Evidence missing" draft passes. Type `Root cause is low cure temperature.`: fail with ROOT_CAUSE_WITHOUT_EVIDENCE.
16. Reload the page: saved state and audit events persist.
