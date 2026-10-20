import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRootCause, ValidationIssueCode } from '../src/lib/validator';
import { createInitialState, sectionDraft } from '../src/lib/data';
import { reviewSection, rootCauseCheck, rootCauseAuditAction, RootCauseRejectedError } from '../src/lib/workflow';

const retrieved = ['NCR-2025-084', 'NCR-2026-019'];
const codes = (text: string, ids: readonly string[] = retrieved, currentNcrId?: string): ValidationIssueCode[] => validateRootCause(text, ids, { currentNcrId }).issues.map(i => i.code);

test('rule A: citing retrieved ids passes', () => {
    assert.deepEqual(validateRootCause('Compare vent condition with NCR-2025-084 and NCR-2026-019.', retrieved), { ok: true, issues: [] });
});

test('rule A: an id that was not retrieved is rejected, once per id', () => {
    const result = validateRootCause('Similar to NCR-2026-032, NCR-2026-032 and NCR-2025-084.', retrieved);
    assert.equal(result.ok, false);
    assert.deepEqual(result.issues.map(i => i.code), ['CITATION_NOT_RETRIEVED']);
    assert.match(result.issues[0].message, /NCR-2026-032/);
});

test('rule A: ids are matched case-insensitively and need exact digits', () => {
    assert.deepEqual(codes('see ncr-2025-084'), []);
    assert.deepEqual(codes('see ncr-2026-999'), ['CITATION_NOT_RETRIEVED']);
    assert.deepEqual(codes('see NCR-2025-0840'), [], 'a longer number is not an NCR id');
});

test('rule A: the current case id is not treated as a citation', () => {
    assert.deepEqual(codes('NCR-2026-104 resembles NCR-2025-084.', retrieved, 'NCR-2026-104'), []);
    assert.deepEqual(codes('NCR-2026-104 resembles NCR-2025-084.'), ['CITATION_NOT_RETRIEVED']);
});

test('rule B: generic English claims are rejected case-insensitively', () => {
    for (const text of ['root cause: human error', 'Root cause: HUMAN ERROR', 'Operator   error during setup', 'Operator needs training', 'lack of training', 'Carelessness at station 3'])
        assert.deepEqual(codes(text), ['GENERIC_CLAIM_UNSUPPORTED'], text);
});

test('rule B: generic Indonesian claims are rejected', () => {
    for (const text of ['Operator kurang teliti saat setup', 'Kelalaian operator shift 2', 'perlu training ulang', 'Kurang hati-hati', 'Penyebab: kesalahan manusia'])
        assert.deepEqual(codes(text), ['GENERIC_CLAIM_UNSUPPORTED'], text);
});

test('rule B: phrases inside other words do not match', () => {
    assert.deepEqual(codes('Inhuman errors are not a phrase here: humanerror'), []);
});

test('rule B: a generic claim passes only with a retrieved citation AND current-lot evidence', () => {
    assert.deepEqual(codes('Human error per NCR-2025-084, confirmed by trial TR-104.'), []);
    assert.deepEqual(codes('Operator kurang teliti, lihat NCR-2026-019 dan gauge study GR-032.'), []);
    assert.deepEqual(codes('Human error per NCR-2025-084.'), ['GENERIC_CLAIM_UNSUPPORTED'], 'citation without evidence');
    assert.deepEqual(codes('Human error confirmed by trial TR-104.'), ['GENERIC_CLAIM_UNSUPPORTED'], 'evidence without citation');
    assert.deepEqual(codes('Human error per NCR-2026-032 and TR-104.'), ['CITATION_NOT_RETRIEVED', 'GENERIC_CLAIM_UNSUPPORTED'], 'a non-retrieved citation does not count');
    assert.deepEqual(codes('Human error per NCR-2025-084 and tr-104.'), [], 'evidence ids are case-insensitive');
});

test('rule B: the message names what is missing', () => {
    const [issue] = validateRootCause('root cause: human error', retrieved).issues;
    assert.match(issue.message, /human error/);
    assert.match(issue.message, /cited retrieved NCR/);
    assert.match(issue.message, /current-lot evidence/);
});

test('rule C: with nothing retrieved, the text must say evidence is missing', () => {
    assert.deepEqual(codes('Evidence missing. Collect process logs before selecting a root cause.', []), []);
    assert.deepEqual(codes('Bukti belum ada. Kumpulkan log proses dulu.', []), []);
    assert.deepEqual(codes('Root cause: unknown. No evidence retrieved yet.', []), []);
    assert.deepEqual(codes('Check coating line parameters.', []), ['ROOT_CAUSE_WITHOUT_EVIDENCE']);
    assert.deepEqual(codes('', []), ['ROOT_CAUSE_WITHOUT_EVIDENCE']);
});

test('rule C: with nothing retrieved, asserting a root cause is rejected even if evidence is said to be missing', () => {
    for (const text of ['Evidence missing. Root cause is spray gun clogging.', 'Evidence missing, but the defect was caused by low cure temperature.', 'Tidak ada bukti. Akar masalah adalah nozzle tersumbat.', 'Bukti belum ada, cacat disebabkan oleh suhu oven.'])
        assert.deepEqual(codes(text, []), ['ROOT_CAUSE_WITHOUT_EVIDENCE'], text);
});

test('rules combine: generic claim with nothing retrieved fails B and C', () => {
    assert.deepEqual(codes('root cause: human error', []), ['GENERIC_CLAIM_UNSUPPORTED', 'ROOT_CAUSE_WITHOUT_EVIDENCE']);
    assert.deepEqual(codes('Evidence missing. NCR-2025-084 looks similar.', []), ['CITATION_NOT_RETRIEVED']);
});

test('valid evidence-backed text passes', () => {
    const text = 'Candidate precedents (historical, not validated): NCR-2025-084, NCR-2026-019. Vent channel blockage reproduced in controlled trial TR-104; parameter log PL-104 matches.';
    assert.deepEqual(validateRootCause(text, retrieved), { ok: true, issues: [] });
});

test('D4 drafts list retrieved precedents by id and pass the validator', () => {
    const s = createInitialState();
    const n = s.ncrs.find(n => n.id === 'NCR-2026-104')!;
    const draft = sectionDraft(n, 3);
    assert.match(draft, /^Candidate precedents \(historical, not validated\): NCR-2025-084 .*; NCR-2026-019 /);
    for (const ncr of s.ncrs)
        assert.deepEqual(rootCauseCheck(s, ncr.id, sectionDraft(ncr, 3)).issues, [], ncr.id);
});

test('reviewSection refuses to approve D4 when the root cause check fails', () => {
    const s = createInitialState();
    s.reports[0].sections[3] = { content: 'root cause: human error', status: 'Draft' };
    assert.throws(() => reviewSection(s, 'NCR-2026-104', 3, true, 'TR-104 reviewed'), (e: unknown) => e instanceof RootCauseRejectedError && e.issues.some(i => i.code === 'GENERIC_CLAIM_UNSUPPORTED'));
    const returned = reviewSection(s, 'NCR-2026-104', 3, false, 'Unsupported generic claim');
    assert.equal(returned.reports[0].sections[3].status, 'Rejected', 'requesting revision is still allowed');
});

test('reviewSection refuses a D4 root cause when nothing was retrieved', () => {
    const s = createInitialState();
    const i = s.reports.findIndex(r => r.ncrId === 'NCR-2026-100');
    s.reports[i].sections = s.reports[i].sections.map((x, d) => ({ ...x, status: d < 3 ? 'Complete' : 'Draft', content: d === 3 ? 'Root cause is low cure temperature.' : x.content }));
    assert.throws(() => reviewSection(s, 'NCR-2026-100', 3, true, 'Reviewed'), /ROOT_CAUSE|No historical evidence/);
});

test('validator audit actions name the trigger and issue codes', () => {
    const issues = validateRootCause('root cause: human error', []).issues;
    assert.equal(rootCauseAuditAction(3, 'approval', issues), 'Root cause check rejected D4 approval: GENERIC_CLAIM_UNSUPPORTED, ROOT_CAUSE_WITHOUT_EVIDENCE.');
    assert.equal(rootCauseAuditAction(3, 'saved', issues.slice(0, 1)), 'Root cause check rejected D4 saved draft: GENERIC_CLAIM_UNSUPPORTED.');
});
