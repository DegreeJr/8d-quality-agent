# Verification status

Last verified: 2026-10-20, branch `feat/validator-and-data`, Windows 11, Node.js v24.19.0, npm 11.17.0, Python 3.12.10.

## Passed (run by the agent, output observed)

- `npm install`: 427 packages added. npm reports 5 high severity advisories, all in devDependencies (`npm audit --omit=dev` reports 0). `npm audit fix --force` was not run.
- `npm run typecheck`: `tsc --noEmit`, exit 0, no errors.
- `npm run lint`: `eslint .`, exit 0, no errors or warnings.
- `npm test` (2026-10-21): 82 tests, 82 pass, 0 fail (5 workflow, 56 shared validator fixture cases including 12 for Rule D, 7 D4, registry and approval-lock integration, 5 retrieval and dataset, 9 agent client and proxy).
- `pytest` in `agent/` (strands-agents 1.61.1, bedrock-agentcore 1.24.2, openai 2.54.0, pytest 9.1.1): 102 passed (checked 2026-10-21). Includes the same 56 validator fixture cases, 4 Rule D service tests, the agent response contract for NCR-2026-104, 14 SAP AI Core tests with mocked HTTP and fake keys, and a guard that fails any test creating an AWS client or calling an AWS API.
- `npm run build`: Next.js 16.4.0 (Turbopack) production build succeeded; 7 pages prerendered as static content, `/api/agent/root-cause` dynamic. The prerendered `/workspace` HTML contains the D4 draft "Candidate precedents (historical, not validated): NCR-2025-084 ...", "Root cause check: pass" and "Registered current-lot evidence for NCR-2026-104: TR-104 (Trial report), PL-104 (Parameter log)".
- `npm run data:generate`: "seed 20261031: 200 NCRs (5 anchors), 400 evidence records, 30 eval cases held out". Running it twice produced byte-identical files (same SHA-256).
- `npm run eval:retrieval`: corpus 170 NCRs, 30 held-out cases, keyword baseline: hit@1 = 27/30 = 0.9, hit@3 = 30/30 = 1. This is a regression check on synthetic data, not a claim about impact or real-world accuracy (see below).
- Local end to end (mock mode, no AWS): `python -m quality_agent.app` served `GET /ping` -> `{"status":"Healthy",...}`. With `NEXT_PUBLIC_AGENT_BACKEND=local` and `npm run dev`, `POST /api/agent/root-cause` for NCR-2026-104 returned HTTP 200 with a body identical to `tests/fixtures/agent-response-mock-104.json` (accepted, retrieved NCR-2025-084, NCR-2023-002, NCR-2023-007). An invalid action returned HTTP 400; with the agent stopped the route returned HTTP 502 "Agent unavailable ...". The agent log contained only the startup line (mode, model id None, region, corpus size).
- SAP AI Core smoke test (2026-10-21, run by the team with the real service key; result reported to the agent, raw output not seen by the agent): `agent/scripts/smoke_sap.py` for NCR-2026-104 returned mode `sap`, model gpt-5.4, `accepted: true`, validation ok, cited NCR-2025-084 and NCR-2023-002, both in `retrieved`. One run; output is model-generated and can differ between runs.
- `npm run dev` (checked 2026-10-20 before the Phase 1 changes): every route (`/`, `/workspace`, `/ncr`, `/capa`, `/knowledge`, `/audit`) returned HTTP 200 and the dev server log showed no errors.

## Not verified

- No browser click testing has been done by the agent. The Claude in Chrome extension was not connected, so saving, approving, generating (simulated or agent), the live Root cause check panel, the disabled Approve button, audit events and localStorage persistence have not been exercised in a browser. Use the manual checklist below.
- SAP AI Core beyond the one smoke test above: `AGENT_MODE=sap` is otherwise covered by unit tests with mocked HTTP and fake keys (token request, endpoint, headers, api-version, a full Strands tool loop, validator enforcement, no secrets in logs). Not yet verified against the real service: the rejection paths (`agent/scripts/smoke_sap_rejections.py`, updated for Rule D, is written but not run), token lifetime, latency, and repeatability across runs. Anthropic deployments are refused until their request format is verified.
- Nothing has run against AWS. `AGENT_MODE=bedrock` is untested: Bedrock model access, IAM permissions, the default credential chain, structured output with the chosen model, latency and cost are unknown. Code that depends on this is marked TODO(verify). Deployment to AgentCore Runtime (ARM64 container) is not built.
- Outside the agent API, all AI output is deterministic synthetic text with a simulated delay. The local agent in mock mode uses no model either.
- The evidence registry is synthetic and lives in code. The check proves a registered id owned by the open NCR is cited, not that the evidence supports the claim. The agent trusts `current_evidence` sent by the UI; a backend registry is needed.
- The retrieval eval saturates: hit@3 is 30/30 because the generator draws from a small closed set of template sentences, so held-out queries share exact phrases with corpus records. The number does not show how the keyword baseline would do on real NCR text and cannot separate a better retriever from this one. A manually written eval set (schema in `data/manual-eval/`) is planned once a Bedrock retriever exists.
- The agent's corpus contains all 200 records, including the 30 eval cases; only the eval script removes them.
- There is no UI to register current-lot evidence yet; the registry is in code (`src/lib/data.ts`), so NCR-2026-100's D4 lock cannot be lifted from the UI.
- Demo scope: only NCR-2026-104 has a realistic description. The other active NCRs use a generic placeholder description, so agent retrieval for them is not meaningful.

## Manual browser checklist

Run `npm run dev`, open http://localhost:3000, reset the demo data from the profile menu, then open http://localhost:3000/workspace (NCR-2026-104, D4).

Existing flow
1. D4 editor shows "Candidate precedents (historical, not validated): NCR-2025-084 (...); NCR-2026-019 (...)". Root cause check panel shows "pass" and "Registered current-lot evidence for NCR-2026-104: TR-104 (Trial report), PL-104 (Parameter log)".
2. Edit the text: Approve is disabled and the approval box says "Save changes first". Click "Save changes": toast "Section saved. Changes invalidate downstream approvals." and Approve is enabled again.
3. Click "Approve" with an empty note, click "Confirm human approval": error "Record validation evidence or a rejection reason."; D4 stays Draft.
4. Approve with note `TR-104: current-lot controlled trial reviewed.`: D4 becomes Approved, D5 unlocks.
5. D5: click "Generate AI suggestion" (about 1.4 s), approve with an empty note (error), then with a note: D5 Approved, D6 unlocks. No Root cause check panel on D5.

Root cause check
6. On D4 (reset first if already approved), clear the editor and type `root cause: human error`: the panel turns to "fail" immediately with GENERIC_CLAIM_UNSUPPORTED, asking for a cited retrieved NCR and a current-lot evidence id such as TR-104.
7. Type `root cause: human error per NCR-2026-032`: CITATION_NOT_RETRIEVED is added (NCR-2026-032 was not retrieved for this case).
8. Type `Operator kurang teliti`: fail with GENERIC_CLAIM_UNSUPPORTED.
9. Type `Human error per NCR-2025-084, see GR-032.`: fail; the message says "GR-032 belongs to NCR-2026-032, not NCR-2026-104".
10. Type `Human error per NCR-2025-084, see TR-999.`: fail; the message says "TR-999 is not in the evidence registry".
11. Type `Human error per NCR-2025-084, confirmed by trial TR-104.`: pass.
12. Type `root cause: human error`, click "Save changes": Agent timeline and Audit Trail show a System event "Root cause check rejected D4 saved draft: GENERIC_CLAIM_UNSUPPORTED." by "Root cause validator".
13. Approve with a note: the dialog shows "Root cause check failed: ...", D4 stays Draft, and a System event "Root cause check rejected D4 approval: GENERIC_CLAIM_UNSUPPORTED." is added.
14. "Request revision" with a reason still works on the failing text.
15. "Generate AI suggestion" restores the draft and the panel shows "pass".
16. Select NCR-2026-100 (no historical cases), open D4: the "Evidence missing" draft passes, the panel shows "Status: unverified hypothesis" and "Registered current-lot evidence for NCR-2026-100: none", and Approve is disabled with "D4 approval is locked: no current-lot evidence is registered for NCR-2026-100 ...". Type `Root cause is low cure temperature.`: fail with ROOT_CAUSE_WITHOUT_EVIDENCE.
17. Reload the page: saved state and audit events persist.

Local agent (optional)
18. Start the agent (`agent/README.md`), then run the UI with `NEXT_PUBLIC_AGENT_BACKEND=local`. The header label reads "Agent API (local) · D4 only".
19. Reset the demo, open NCR-2026-104 D4, click "Generate AI suggestion": the draft starts "Agent proposal (local agent, mock mode without a model, not validated): Hypothesis (historical, not validated): Vent channel blockage ...", the Historical evidence card lists NCR-2025-084, NCR-2023-002 and NCR-2023-007 as "Retrieved by agent tools", the panel shows "pass", and the Audit Trail shows an AI event by "Quality agent (local agent, mock mode without a model)".
20. Type `Similar to NCR-2026-019.` in D4: CITATION_NOT_RETRIEVED, because the agent did not retrieve it.
21. Stop the agent and click Generate again: toast "Agent unavailable: ..." and a System audit event "Agent call failed: ...".
22. With the agent running, open NCR-2026-100 D4 and Generate: the draft ends with "Status: unverified hypothesis, no current-lot evidence registered." and Approve stays locked. Type `Root cause is confirmed: worn nozzle, as in <a retrieved id>.`: fail with ROOT_CAUSE_CLAIMED_CONFIRMED.
