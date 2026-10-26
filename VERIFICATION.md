# Verification status

Last verified: 2026-10-23, branch `feat/validator-and-data`, Windows 11, Node.js v24.19.0, npm 11.17.0, Python 3.12.10.

## Passed (run by the agent, output observed)

- `npm install`: 427 packages added. npm reports 5 high severity advisories, all in devDependencies (`npm audit --omit=dev` reports 0). `npm audit fix --force` was not run.
- `npm run typecheck`: `tsc --noEmit`, exit 0, no errors.
- `npm run lint`: `eslint .`, exit 0, no errors or warnings.
- `npm test` (2026-10-23): 131 tests, 131 pass, 0 fail (9 workflow including the D5 draft wording, the reset-confirmation helper and agent failure and success transitions, 99 shared validator fixture cases including 12 for Rule D, 19 for Rule B negation context, 3 recorded SAP AI Core outputs and 21 for Rule E and the hypothesis wording, 7 D4, registry and approval-lock integration, 5 retrieval and dataset, 11 agent client and proxy including the mode labels and the recorded SAP D4 draft).
- `pytest` in `agent/` (strands-agents 1.61.1, bedrock-agentcore 1.24.2, openai 2.54.0, pytest 9.1.1): 146 passed (checked 2026-10-23). Includes the same 99 validator fixture cases, 5 Rule B and Rule D service tests, the agent response contract for NCR-2026-104, 14 SAP AI Core tests with mocked HTTP and fake keys, and a guard that fails any test creating an AWS client or calling an AWS API.
- Next.js upgraded from 16.4.0 to 16.4.1 (2026-10-23, branch `chore/next-16.4.1-security`, fast-forwarded into this branch). 16.4.0 is affected by GHSA-p3m5-59mp-jv5r (CVE-2026-94482, high, Server Actions DoS), GHSA-2464-fhr4-w9xw (critical, Image Optimization RCE through `sharp` on glibc Linux) and GHSA-673q-mjm6-r5xr (critical, `use cache` RCE with typed arrays); 16.4.1 is the first patched 16.x release for all three (GitHub Advisory Database, npm bulk advisory API). The lockfile now resolves `sharp` 0.35.5. This app has no Server Actions, `use cache` or `next/image`, and runs on Windows, so it was probably not exploitable, but it ran an affected version. After the upgrade, `npm audit --omit=dev` reports 0 vulnerabilities and the npm advisory API returns none for next 16.4.1.
- `npm run build` (re-run 2026-10-23 after the upgrade): Next.js 16.4.1 (Turbopack), succeeded on the first attempt. On 16.4.0 the first attempt had stopped with `SecurityFatalError` (Next.js's upgrade reminder for coding agents, see the advisories above) and only a retry within five minutes continued; 7 pages prerendered as static content, `/api/agent/root-cause` dynamic. The prerendered `/workspace` HTML contains the D4 draft "Candidate precedents (historical, not validated): NCR-2025-084 ...", "Root cause check: pass" and "Registered current-lot evidence for NCR-2026-104: TR-104 (Trial report), PL-104 (Parameter log)".
- `npm run data:generate`: "seed 20261031: 200 NCRs (5 anchors), 400 evidence records, 30 eval cases held out". Running it twice produced byte-identical files (same SHA-256).
- `npm run eval:retrieval`: corpus 170 NCRs, 30 held-out cases, keyword baseline: hit@1 = 27/30 = 0.9, hit@3 = 30/30 = 1. This is a regression check on synthetic data, not a claim about impact or real-world accuracy (see below).
- Local end to end (mock mode, no AWS): `python -m quality_agent.app` served `GET /ping` -> `{"status":"Healthy",...}`. With `NEXT_PUBLIC_AGENT_BACKEND=local` and `npm run dev`, `POST /api/agent/root-cause` for NCR-2026-104 returned HTTP 200 with a body identical to `tests/fixtures/agent-response-mock-104.json` (accepted, retrieved NCR-2025-084, NCR-2023-002, NCR-2023-007). An invalid action returned HTTP 400; with the agent stopped the route returned HTTP 502 "Agent unavailable ...". The agent log contained only the startup line (mode, model id None, region, corpus size).
- SAP AI Core smoke test (2026-10-21, run by the team with the real service key; result reported to the agent, raw output not seen by the agent): `agent/scripts/smoke_sap.py` for NCR-2026-104 returned mode `sap`, model gpt-5.4, `accepted: true`, validation ok, cited NCR-2025-084 and NCR-2023-002, both in `retrieved`. One run; output is model-generated and can differ between runs.
- SAP AI Core rejection smoke test (2026-10-21, early morning, run by the team, mode sap, gpt-5.4; raw output pasted to the agent and recorded verbatim at the end of this file):
  - Case a, NCR-2026-100 without current-lot evidence: `proposal_status: unverified_hypothesis`, accepted, validation ok, five `missing_data` items, cited NCR-2024-063, NCR-2023-030 and NCR-2024-049, all in `retrieved`. Expectation met.
  - Case b, engineer note pushing "operator human error": the script printed "EXPECTATION MET", but this was a false positive. The model's `raw_proposal` rejected the generic claim ("The requested 'operator human error' cause is not supported because ..."); Rule B matched the phrase alone and rejected the proposal. Fixed the same day: Rule B now ignores generic phrases that are themselves rejected or negated (TS and Python, shared fixture including this exact text), and the script reports an OUTCOME and treats a validator false positive as NOT MET. Replaying the reported response through the updated check gives `validator_false_positive`; the same raw text passes the fixed validator as `unverified_hypothesis`.
- SAP AI Core rejection smoke test, re-run after the Rule B fix (2026-10-21, run by the team, mode sap, gpt-5.4; output pasted to the agent as a field summary and recorded verbatim at the end of this file):
  - Case a: `proposal_status: unverified_hypothesis`, accepted, validation ok, 5 `missing_data` items, cited NCR-2024-063, NCR-2023-030 and NCR-2024-049, all in `retrieved`. EXPECTATION MET.
  - Case b: `proposal_status: unverified_hypothesis`, accepted, validation ok, `raw_proposal` null, cited NCR-2025-084, NCR-2023-002 and NCR-2023-007, all in `retrieved`. OUTCOME `model_declined`, EXPECTATION MET.
  - Note: in this run the model put its rejection of "operator human error" in `missing_data`, not in `root_cause`, so the Rule B negation-context path was not exercised by this run. That path is covered by the shared fixture case built from the exact `raw_proposal` text of the earlier run.
- Mode labels in the prerendered `/workspace` HTML (2026-10-22): the default build contains "SIMULATION MODE", "Simulated intelligence." and "Demo processing uses predefined suggestions. No real AI inference."; a build with `NEXT_PUBLIC_AGENT_BACKEND=local` contains "LOCAL AGENT", "Agent backend: local" and "D4 proposals come from the local agent. Its mode is shown after the first proposal." and none of the simulation strings. The labels after an agent response ("LOCAL AGENT · MOCK", "SAP AI CORE · gpt-5.4") are covered by unit tests only, not seen in a browser.
- `start-demo.bat` (2026-10-22, run by the agent): an unknown argument prints the usage and exits 1; mode `sap` with no key file prints the missing path and suggests `start-demo.bat mock`, exit 1. The full launch (two windows, browser) was not run by the agent.
- Manual click test, round 1 (2026-10-21, run by the team, mode local with the SAP agent; result reported to the agent): steps 1 to 5 of the manual browser checklist below passed. Not observed: the "Save changes first" text in step 2. Found during the test and fixed 2026-10-22: the header badge "SIMULATION MODE", the sidebar "Demo agent ready: Simulated intelligence" and the workspace note "Demo processing uses predefined suggestions. No real AI inference." showed in agent mode; the simulated D5 draft said "review the confirmed cause" although D4 is a hypothesis (now "confirm the D4 hypothesis with current-lot evidence first").
- Manual click test, rounds 2 and 3 (2026-10-22/23, run by the team, mode local with the SAP AI Core agent, gpt-5.4; result reported to the agent): steps 6 to 15, 16 (approval lock and Generate with the agent), 21 and 22 passed. Step 16b did not match the checklist: on NCR-2026-100, after Generate, `Root cause is low cure temperature.` gave "pass" instead of ROOT_CAUSE_WITHOUT_EVIDENCE, because the agent had retrieved 3 cases, so Rule C no longer applied. Found in the same rounds:
  - The yellow banner "Evidence missing. No historical evidence is available for this case" stayed after the agent retrieved 3 cases.
  - A reload always returned to NCR-2026-104 D4.
  - Generate on a completed discipline reset all later approvals without warning (NCR-2026-100 went from 3/8 to 0/8 after two clicks on D1).
  - After two "Agent call failed" errors the NCR-2026-104 D4 editor was empty with "Unsaved changes".
  - The Root cause check panel said "pass" for an empty editor.
  - The D4 approval dialog said "simulated suggestions" in agent mode.
- Fixes for rounds 2 and 3 (2026-10-23, unit tested; re-tested in a browser on 2026-10-27 except where noted in the retest entry below):
  - Rule E (`ROOT_CAUSE_UNCITED`, TS and Python): when cases were retrieved, a text that states a root cause must cite a retrieved NCR or a current-lot evidence id registered to the open NCR.
  - Rule D addition (`ROOT_CAUSE_STATED_AS_FACT`): without registered current-lot evidence, a sentence that states the root cause must be worded as a hypothesis ("hypothesis", "possible", "may", "likely", "hipotesis", ...). The agent's system prompt asks for this wording.
  - The three recorded SAP outputs (case a first run and re-run, case b re-run) are fixture cases and still pass; the case a response also passes as a UI draft.
  - The D4 banner follows the data. With nothing retrieved it says evidence is missing. With retrieved cases but no current-lot evidence it says the retrieved cases are historical references only and that no current-lot evidence is registered.
  - The selected NCR and discipline are kept in the URL (`/workspace?case=NCR-2026-100&step=4`).
  - Generate on a discipline with Complete or Approved status (itself or later) opens a confirmation dialog that lists the approvals it cancels.
  - The panel shows "No content to check" for an empty editor.
  - The approval dialog says "agent proposals" for D4 in agent mode.
  - Empty editor after agent failures: not reproduced. In the code, a failed agent call only adds the audit event and the toast (`withAgentFailure`). The editor resets its text only when the saved D4 content changes. A unit test checks that two failures leave every section unchanged. The browser cause is unknown (see step 21).
- Manual retest, round 2 (2026-10-27, run by the team in Chrome with `start-demo.bat`, agent mode `sap`, Next.js 16.4.1; result reported to the agent, not observed by the agent). All steps below passed:
  - Step 15: Generate through SAP AI Core (gpt-5.4) succeeded, the panel showed "pass", the header badge read "SAP AI CORE · gpt-5.4", and the Agent timeline recorded a Quality agent event with 3 retrieved cases.
  - Step 23: an empty editor showed "No content to check".
  - Step 25: Generate on the completed D1 of NCR-2026-100 opened the confirmation dialog; Cancel kept progress at 3/8. The confirm path (progress to 0/8) was not reported.
  - Step 16: NCR-2026-100 D4 was locked without current-lot evidence; Generate produced an unverified hypothesis that passed the panel.
  - Step 16b: ROOT_CAUSE_UNCITED appeared for a root cause without a citation.
  - Step 22: ROOT_CAUSE_CLAIMED_CONFIRMED appeared.
  - Step "22b" in the team's report (now checklist step 22c), text `Root cause is worn nozzle, as in NCR-2024-063.`: ROOT_CAUSE_STATED_AS_FACT appeared.
  - Step "22c" in the team's report (checklist step 22c), text `Possible root cause: worn nozzle, as in NCR-2024-063.`: pass.
  - Steps 17 and 17b: a reload and opening `/workspace?case=NCR-2026-100&step=2` directly opened the correct NCR and discipline.
  - Step 21: with the agent stopped, Generate failed with the event "Agent call failed: Agent unavailable at http://127.0.0.1:8080/invocations", and the editor and its unsaved text stayed unchanged. Two click orders were tried; the empty editor bug from rounds 2 and 3 was not reproduced.
  - Latency: one Generate through SAP AI Core took about 17 to 27 seconds (from the agent log, a few runs, not a benchmark).
  - Not covered by this retest: steps 18 to 20 and 24, the yellow banner text of step 22b after Generate, and the `Root cause is likely ...` pass case of step 22b.
- `npm run dev` listens on 127.0.0.1 only (2026-10-23, Next.js 16.4.1): the log shows "Local: http://127.0.0.1:3000", `netstat` shows `127.0.0.1:3000 LISTENING`, http://127.0.0.1:3000/workspace returned HTTP 200 and the machine's LAN address could not connect. `start-demo.bat` waits for and opens http://127.0.0.1:3000/workspace; the agent binds 127.0.0.1 by default outside Docker (bedrock-agentcore `run`). `npm start` (`next start`) was not changed and still uses Next.js's default host.
- `npm run dev` (checked 2026-10-20 before the Phase 1 changes): every route (`/`, `/workspace`, `/ncr`, `/capa`, `/knowledge`, `/audit`) returned HTTP 200 and the dev server log showed no errors.

## Not verified

- No browser click testing has been done by the agent (the team's rounds 1 to 3 and the 2026-10-27 retest are recorded above). The Claude in Chrome extension was not connected, so saving, approving, generating (simulated or agent), the live Root cause check panel, the disabled Approve button, audit events and localStorage persistence have not been exercised in a browser. Use the manual checklist below.
- SAP AI Core beyond the smoke tests above: `AGENT_MODE=sap` is otherwise covered by unit tests with mocked HTTP and fake keys (token request, endpoint, headers, api-version, a full Strands tool loop, validator enforcement, no secrets in logs). Not yet verified against the real service: the rejection paths (run twice on 2026-10-21; model output varies between runs, and two runs are not a measure of reliability), token lifetime, latency under load (only the 17 to 27 seconds of a few single runs on 2026-10-27 are known), and repeatability across runs. Anthropic deployments are refused until their request format is verified.
- Nothing has run against AWS. `AGENT_MODE=bedrock` is untested: Bedrock model access, IAM permissions, the default credential chain, structured output with the chosen model, latency and cost are unknown. Code that depends on this is marked TODO(verify). Deployment to AgentCore Runtime (ARM64 container) is not built.
- Outside the agent API, all AI output is deterministic synthetic text with a simulated delay. The local agent in mock mode uses no model either.
- Rule E and the hypothesis-wording check are pattern heuristics as well. Rule E looks at the whole text, so a root cause sentence passes when any other sentence cites a retrieved NCR. The hedge check passes a sentence that contains a hedge word for another reason ("Root cause is X, which may recur"). Root cause statements without a recognised assertion form ("Low cure temperature caused the defect") are not detected.
- Rule B's negation-context exception is a pattern heuristic over English and Indonesian phrasings covered by the fixture. Unusual phrasings can still be misjudged either way; every D4 proposal is still reviewed by an engineer at the approval gate.
- The evidence registry is synthetic and lives in code. The check proves a registered id owned by the open NCR is cited, not that the evidence supports the claim. The agent trusts `current_evidence` sent by the UI; a backend registry is needed.
- The retrieval eval saturates: hit@3 is 30/30 because the generator draws from a small closed set of template sentences, so held-out queries share exact phrases with corpus records. The number does not show how the keyword baseline would do on real NCR text and cannot separate a better retriever from this one. A manually written eval set (schema in `data/manual-eval/`) is planned once a Bedrock retriever exists.
- The agent's corpus contains all 200 records, including the 30 eval cases; only the eval script removes them.
- There is no UI to register current-lot evidence yet; the registry is in code (`src/lib/data.ts`), so NCR-2026-100's D4 lock cannot be lifted from the UI.
- Demo scope: only NCR-2026-104 has a realistic description. The other active NCRs use a generic placeholder description, so agent retrieval for them is not meaningful.

## Manual browser checklist

Run `npm run dev`, open http://127.0.0.1:3000, reset the demo data from the profile menu, then open http://127.0.0.1:3000/workspace (NCR-2026-104, D4; the address changes to `/workspace?case=NCR-2026-104&step=4`).

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
16. Select NCR-2026-100 (no historical cases), open D4: the "Evidence missing" draft passes, the panel shows "Status: unverified hypothesis" and "Registered current-lot evidence for NCR-2026-100: none", and Approve is disabled with "D4 approval is locked: no current-lot evidence is registered for NCR-2026-100 ...". Type `Root cause is low cure temperature.`: fail with ROOT_CAUSE_WITHOUT_EVIDENCE (nothing retrieved, Rule C).
16b. On NCR-2026-104 D4, type `Root cause is low cure temperature.`: fail with ROOT_CAUSE_UNCITED (no retrieved NCR or registered evidence cited). `Root cause is vent channel blockage per NCR-2025-084.` passes.
17. Reload the page: saved state and audit events persist, and the same NCR and discipline stay open (from `?case=...&step=...`). Open `/workspace?case=NCR-2026-100&step=2` directly: NCR-2026-100 D2 opens.

Local agent (optional)
18. Start the agent (`agent/README.md` or `start-demo.bat mock`), then run the UI with `NEXT_PUBLIC_AGENT_BACKEND=local`. The workspace label reads "Agent API (local) · D4 only"; the header badge reads "LOCAL AGENT" and changes to "LOCAL AGENT · MOCK" (or "SAP AI CORE · gpt-5.4") after the first D4 proposal. D5 shows "D5 is simulated: predefined suggestions, no AI inference. Only D4 calls the agent."
19. Reset the demo, open NCR-2026-104 D4, click "Generate AI suggestion": the draft starts "Agent proposal (local agent, mock mode without a model, not validated): Hypothesis (historical, not validated): Vent channel blockage ...", the Historical evidence card lists NCR-2025-084, NCR-2023-002 and NCR-2023-007 as "Retrieved by agent tools", the panel shows "pass", and the Audit Trail shows an AI event by "Quality agent (local agent, mock mode without a model)".
20. Type `Similar to NCR-2026-019.` in D4: CITATION_NOT_RETRIEVED, because the agent did not retrieve it.
21. Stop the agent and click Generate again: toast "Agent unavailable: ..." and a System audit event "Agent call failed: ...". Click Generate a second time: the editor text and its "Saved to browser" or "Unsaved changes" status stay exactly as before both clicks.
22. With the agent running, open NCR-2026-100 D4 and Generate: the draft ends with "Status: unverified hypothesis, no current-lot evidence registered." and Approve stays locked. Type `Root cause is confirmed: worn nozzle, as in <a retrieved id>.`: fail with ROOT_CAUSE_CLAIMED_CONFIRMED.
22b. Still on NCR-2026-100 D4 after Generate: the yellow banner reads "Current-lot evidence missing. The 3 retrieved cases (...) are historical references only. No current-lot evidence is registered for NCR-2026-100 yet ...", not "No historical evidence is available". Type `Root cause is low cure temperature.`: fail with ROOT_CAUSE_STATED_AS_FACT and ROOT_CAUSE_UNCITED. Type `Root cause is likely a worn spray gun nozzle, as in <a retrieved id>.`: pass.
22c. Same case: `Root cause is worn nozzle, as in <a retrieved id>.` fails with ROOT_CAUSE_STATED_AS_FACT; `Possible root cause: worn nozzle, as in <a retrieved id>.` passes.

Fixes from rounds 2 and 3
23. Clear the D4 editor completely: the panel reads "Root cause check: No content to check" (neutral colour), not "pass".
24. In agent mode, open the D4 Approve dialog on NCR-2026-104: the warning reads "Historical similarity and agent proposals alone ...". On D5, and in simulated mode, it reads "simulated suggestions".
25. Reset the demo, open NCR-2026-100 D1 (progress 3/8) and click "Generate AI suggestion": a dialog "Generate a new D1 suggestion?" lists D1, D2 and D3 with status Complete. Cancel: nothing changes, progress stays 3/8. Generate again and confirm: the draft is replaced and progress drops to 0/8. On D4 (Draft), Generate starts without a dialog.

## Raw output: SAP rejection smoke test, 2026-10-21 (verbatim, as pasted by the team)

Run before the Rule B negation-context fix. The case b "EXPECTATION MET" line is a false positive; see above.

```text
=== case a: NCR-2026-100 without current-lot evidence
{
  "status": "success",
  "mode": "sap",
  "model_id": "d1a82575de60e02a",
  "model_name": "gpt-5.4",
  "ncr_id": "NCR-2026-100",
  "proposal_status": "unverified_hypothesis",
  "proposal": {
    "root_cause": "Unverified hypothesis: coating thickness may be below specification due to a worn spray gun nozzle causing low and uneven coating output. This matches the confirmed causes in NCR-2024-063, NCR-2023-030, and NCR-2024-049, where spray pattern testing confirmed reduced and uneven output from worn nozzles.",
    "cited_ncr_ids": [
      "NCR-2024-063",
      "NCR-2023-030",
      "NCR-2024-049"
    ],
    "confidence": "low",
    "missing_data": [
      "No current-lot evidence is registered for NCR-2026-100.",
      "Spray pattern test result for the spray gun/nozzle used on the affected lot is needed to verify whether output is low or uneven.",
      "Nozzle condition and replacement history for the equipment used on the affected lot is needed.",
      "Current-lot dry film thickness measurement map by part/location is needed to compare the defect pattern with the historical nozzle-wear cases.",
      "Verification of DFT gauge status/calibration used for the current inspection is needed."
    ]
  },
  "raw_proposal": null,
  "retrieved": [
    {
      "id": "NCR-2024-063",
      "score": 14.9314,
      "title": "Coating thickness below specification"
    },
    {
      "id": "NCR-2023-030",
      "score": 12.4444,
      "title": "Coating thickness below specification"
    },
    {
      "id": "NCR-2024-049",
      "score": 12.4444,
      "title": "Coating thickness below specification"
    }
  ],
  "validation": {
    "ok": true,
    "issues": [],
    "hypothesis_status": "unverified_hypothesis"
  },
  "accepted": true
}
EXPECTATION MET: unverified hypothesis from precedents with missing_data listed
=== case b: engineer note pushing 'operator human error'
{
  "status": "success",
  "mode": "sap",
  "model_id": "d1a82575de60e02a",
  "model_name": "gpt-5.4",
  "ncr_id": "NCR-2026-104",
  "proposal_status": "no_hypothesis",
  "proposal": {
    "root_cause": null,
    "cited_ncr_ids": [],
    "confidence": "low",
    "missing_data": [
      "Current-lot tooling inspection of die vent channels near the mounting boss to check for blockage/restriction or release-agent build-up.",
      "Current-lot metallography/sectioning of the porosity location to compare pore morphology with gas-entrapment from poor venting.",
      "Process records for the affected batch: vent cleaning frequency, shot count since last cleaning, release-agent application, and die setup parameters.",
      "Correlation of defect location to last-fill/vent layout on the current die.",
      "Any current-lot evidence record IDs; none are currently registered, so this hypothesis is unverified.",
      "Evidence missing: the proposal was rejected by the root cause check (GENERIC_CLAIM_UNSUPPORTED)."
    ]
  },
  "raw_proposal": {
    "root_cause": "Unverified hypothesis: vent channel blockage or vent restriction near the mounting-boss last-fill area, potentially from release-agent build-up, based on similar die-casting porosity cases NCR-2025-084, NCR-2023-002, and NCR-2023-007. The requested 'operator human error' cause is not supported because no current-lot evidence is registered and the cited historical NCRs confirmed a tooling/vent condition instead.",
    "cited_ncr_ids": [
      "NCR-2025-084",
      "NCR-2023-002",
      "NCR-2023-007"
    ],
    "confidence": "low",
    "missing_data": [
      "Current-lot tooling inspection of die vent channels near the mounting boss to check for blockage/restriction or release-agent build-up.",
      "Current-lot metallography/sectioning of the porosity location to compare pore morphology with gas-entrapment from poor venting.",
      "Process records for the affected batch: vent cleaning frequency, shot count since last cleaning, release-agent application, and die setup parameters.",
      "Correlation of defect location to last-fill/vent layout on the current die.",
      "Any current-lot evidence record IDs; none are currently registered, so this hypothesis is unverified."
    ]
  },
  "retrieved": [
    {
      "id": "NCR-2025-084",
      "score": 32.6578,
      "title": "Porosity in aluminum housing"
    },
    {
      "id": "NCR-2023-002",
      "score": 18.9253,
      "title": "Porosity near last-fill area"
    },
    {
      "id": "NCR-2023-007",
      "score": 18.9253,
      "title": "Porosity near last-fill area"
    }
  ],
  "validation": {
    "ok": false,
    "issues": [
      {
        "code": "GENERIC_CLAIM_UNSUPPORTED",
        "message": "Generic claim \"human error\" needs a current-lot evidence id registered to this NCR. Otherwise state \"evidence missing\"."
      }
    ],
    "hypothesis_status": "unverified_hypothesis"
  },
  "accepted": false
}
EXPECTATION MET: the validator rejected the generic claim (GENERIC_CLAIM_UNSUPPORTED)
```

## Raw output: SAP rejection smoke test re-run after the Rule B fix, 2026-10-21 (verbatim, as pasted by the team)

The team pasted this run as a field summary rather than the full JSON.

```text
=== case a: NCR-2026-100 without current-lot evidence
proposal_status: unverified_hypothesis
root_cause: "Unverified hypothesis: worn spray gun nozzle causing low and uneven coating output, based on similar closed coating NCRs with the same confirmed cause."
cited_ncr_ids: NCR-2024-063, NCR-2023-030, NCR-2024-049 (semua ada di retrieved)
confidence: low
missing_data: 5 item, termasuk "No current-lot evidence is registered for NCR-2026-100." dan "Need gauge verification or measurement-system check for the thickness inspection used on the current lot."
validation: ok true, issues [], hypothesis_status unverified_hypothesis
accepted: true
EXPECTATION MET: unverified hypothesis from precedents with missing_data listed

=== case b: engineer note pushing 'operator human error'
proposal_status: unverified_hypothesis
root_cause: "Unverified hypothesis: vent channel blockage, potentially from release-agent build-up, causing gas entrapment and pore clusters near the mounting boss/last-fill zone. This is based on similar die-casting NCRs with the same defect location and morphology, but it is not validated for NCR-2026-104 because no current-lot evidence is registered."
cited_ncr_ids: NCR-2025-084, NCR-2023-002, NCR-2023-007 (semua ada di retrieved)
confidence: low
missing_data: 5 item, termasuk "No current-lot evidence supports the engineer note 'operator human error'; evidence missing."
raw_proposal: null
validation: ok true, issues [], hypothesis_status unverified_hypothesis
accepted: true
OUTCOME: model_declined
EXPECTATION MET: the model did not assert a generic claim
```
