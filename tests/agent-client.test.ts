import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentError, agentDraft, buildAgentRequest, parseAgentResponse, proposeRootCause, type AgentResponse } from '../src/lib/agent-client';
import { forwardToAgent } from '../src/lib/agent-proxy';
import { createInitialState, evidenceRegistry } from '../src/lib/data';
import { rootCauseCheck } from '../src/lib/workflow';

// Produced by the Python agent in mock mode (agent/tests/test_contract.py).
const contract = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'agent-response-mock-104.json'), 'utf8')) as AgentResponse;
const fakeFetch = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

test('agent request carries only evidence registered to the NCR', () => {
    const n = createInitialState().ncrs.find(n => n.id === 'NCR-2026-104')!;
    const req = buildAgentRequest(n, evidenceRegistry);
    assert.equal(req.action, 'propose_root_cause');
    assert.deepEqual(req.current_evidence, [{ id: 'TR-104', ncrId: 'NCR-2026-104' }, { id: 'PL-104', ncrId: 'NCR-2026-104' }]);
});

test('the Python mock response parses and its D4 draft passes the TypeScript root cause check', () => {
    const r = parseAgentResponse(contract);
    const s = createInitialState();
    s.reports[0].agentRetrieved = r.retrieved;
    const draft = agentDraft(r);
    assert.match(draft, /^Agent proposal \(local agent, mock mode without a model, not validated\): Hypothesis \(historical, not validated\)/);
    assert.deepEqual(rootCauseCheck(s, 'NCR-2026-104', draft).issues, []);
});

test('after an agent proposal, rule A uses the ids the agent retrieved', () => {
    const s = createInitialState();
    s.reports[0].agentRetrieved = contract.retrieved;
    assert.equal(rootCauseCheck(s, 'NCR-2026-104', 'Similar to NCR-2026-019.').issues[0]?.code, 'CITATION_NOT_RETRIEVED', 'seed precedent not retrieved by the agent');
    assert.equal(rootCauseCheck(s, 'NCR-2026-104', 'Similar to NCR-2023-002.').ok, true);
});

test('a rejected proposal becomes an evidence-missing draft that passes the check', () => {
    const rejected: AgentResponse = { ...contract, accepted: false, proposal: { root_cause: null, cited_ncr_ids: [], confidence: 'low', missing_data: ['Evidence missing: the proposal was rejected by the root cause check (GENERIC_CLAIM_UNSUPPORTED).'] }, validation: { ok: false, issues: [{ code: 'GENERIC_CLAIM_UNSUPPORTED', message: 'x' }] } };
    const draft = agentDraft(rejected);
    assert.match(draft, /^Evidence missing\. The agent proposal .* was rejected by the root cause check: GENERIC_CLAIM_UNSUPPORTED\./);
    const s = createInitialState();
    s.reports[0].agentRetrieved = contract.retrieved;
    assert.equal(rootCauseCheck(s, 'NCR-2026-104', draft).ok, true);
});

test('invalid agent responses are refused', () => {
    assert.throws(() => parseAgentResponse({ status: 'error', error: 'Unsupported action.' }), (e: unknown) => e instanceof AgentError && e.message === 'Unsupported action.');
    assert.throws(() => parseAgentResponse({ ...contract, proposal: { ...contract.proposal, confidence: 0.9 } }), AgentError);
    assert.throws(() => parseAgentResponse(null), AgentError);
});

test('client posts to the app API route', async () => {
    let called = '';
    const f = (async (url: string | URL | Request) => { called = String(url); return new Response(JSON.stringify(contract)); }) as typeof fetch;
    const r = await proposeRootCause(buildAgentRequest(createInitialState().ncrs[0], evidenceRegistry), f);
    assert.equal(called, '/api/agent/root-cause');
    assert.equal(r.accepted, true);
});

test('proxy forwards to /invocations and maps agent errors', async () => {
    let url = '';
    const capture = (async (u: string | URL | Request) => { url = String(u); return new Response(JSON.stringify(contract)); }) as typeof fetch;
    assert.equal((await forwardToAgent({ action: 'propose_root_cause' }, 'http://127.0.0.1:8080/', capture)).status, 200);
    assert.equal(url, 'http://127.0.0.1:8080/invocations');
    assert.equal((await forwardToAgent({}, 'http://agent', fakeFetch(200, { status: 'error', error: 'bad' }))).status, 400);
    assert.equal((await forwardToAgent({}, 'http://agent', fakeFetch(500, { detail: 'boom' }))).status, 502);
    const down = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    const result = await forwardToAgent({}, 'http://agent', down);
    assert.equal(result.status, 502);
    assert.match((result.body as { error: string }).error, /Agent unavailable at http:\/\/agent\/invocations/);
});
