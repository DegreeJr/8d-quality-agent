import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, sectionDraft } from '../src/lib/data';
import { approvalsResetBy, canAccess, reviewSection, withAgentDraft, withAgentFailure } from '../src/lib/workflow';
import type { AgentResponse } from '../src/lib/agent-client';
import type { AuditEvent } from '../src/lib/types';
test('D4 blocks D5 and D6 until a human approves', () => { const s = createInitialState(); assert.equal(canAccess(s, 'NCR-2026-104', 3), true); assert.equal(canAccess(s, 'NCR-2026-104', 4), false); assert.throws(() => reviewSection(s, 'NCR-2026-104', 3, true, ''), /validation evidence/); const reviewed = reviewSection(s, 'NCR-2026-104', 3, true, 'TR-104: current-lot controlled trial reviewed.'); assert.equal(canAccess(reviewed, 'NCR-2026-104', 4), true); assert.equal(canAccess(reviewed, 'NCR-2026-104', 5), false); });
test('D5 also requires approval and validation notes', () => { let s = reviewSection(createInitialState(), 'NCR-2026-104', 3, true, 'D4 trial reviewed'); s.reports[0].sections[4] = { content: 'Validated corrective action plan', status: 'Draft' }; assert.throws(() => reviewSection(s, 'NCR-2026-104', 4, true, '')); s = reviewSection(s, 'NCR-2026-104', 4, true, 'Pilot plan and acceptance criteria reviewed'); assert.equal(canAccess(s, 'NCR-2026-104', 5), true); });
test('rejecting D4 revokes downstream approval', () => { let s = reviewSection(createInitialState(), 'NCR-2026-104', 3, true, 'Trial reviewed'); s.reports[0].sections[4] = { content: 'Corrective plan', status: 'Approved' }; s = reviewSection(s, 'NCR-2026-104', 3, false, 'Need repeat trial'); assert.equal(s.reports[0].sections[4].status, 'Draft'); assert.equal(canAccess(s, 'NCR-2026-104', 4), false); });
test('D8 cannot close while linked CAPAs remain open', () => { const s = createInitialState(); s.reports[0].sections = s.reports[0].sections.map((r, i) => ({ ...r, content: 'Reviewed findings', status: i === 3 || i === 4 ? 'Approved' : 'Complete' })); assert.throws(() => reviewSection(s, 'NCR-2026-104', 7, true, 'Reviewed'), /CAPAs/); });
test('every linked entity references an existing NCR', () => { const s = createInitialState(); const ids = new Set(s.ncrs.map(n => n.id)); for (const r of [...s.reports, ...s.capas, ...s.audit])
    assert.ok(ids.has(r.ncrId)); });
test('the simulated D5 draft does not call the D4 hypothesis a confirmed cause', () => { const d5 = sectionDraft(createInitialState().ncrs[0], 4); assert.doesNotMatch(d5, /confirmed cause/i); assert.match(d5, /D4 hypothesis/); });
test('generating on D1 would reset the D1 to D3 completions, so the workspace asks first', () => {
    const s = createInitialState();
    assert.deepEqual(approvalsResetBy(s, 'NCR-2026-100', 0), [0, 1, 2]);
    assert.deepEqual(approvalsResetBy(s, 'NCR-2026-100', 2), [2]);
    assert.deepEqual(approvalsResetBy(s, 'NCR-2026-100', 3), [], 'D4 is a draft, nothing to confirm');
});
test('a failed agent call leaves the report and the D4 editor content unchanged', () => {
    const s = createInitialState();
    s.reports[0].sections[3] = { content: 'Similar to NCR-2026-019.', status: 'Draft' };
    const failure: AuditEvent = { id: 'e1', ncrId: 'NCR-2026-104', actor: 'Root cause validator', kind: 'System', action: 'Agent call failed: Agent unavailable', timestamp: '2026-10-23T00:00:00.000Z' };
    const after = withAgentFailure(withAgentFailure(s, failure), { ...failure, id: 'e2' });
    assert.deepEqual(after.reports, s.reports, 'two failures change no section');
    assert.equal(after.reports[0].sections[3].content, 'Similar to NCR-2026-019.');
    assert.deepEqual(after.audit.slice(0, 2).map(a => a.id), ['e2', 'e1']);
});
test('a successful agent proposal replaces D4 and revokes later approvals', () => {
    const s = createInitialState();
    s.reports[0].sections[4] = { content: 'Corrective plan', status: 'Approved' };
    const r = { retrieved: [{ id: 'NCR-2025-084', score: 1, title: 'Porosity' }] } as AgentResponse;
    const after = withAgentDraft(s, 'NCR-2026-104', 3, 'Agent draft', r);
    assert.deepEqual(after.reports[0].sections[3], { content: 'Agent draft', status: 'Draft' });
    assert.equal(after.reports[0].sections[4].status, 'Draft');
    assert.deepEqual(after.reports[0].agentRetrieved, r.retrieved);
});
