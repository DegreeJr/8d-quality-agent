import { AppState, AuditEvent, EvidenceRecord, ReportSection } from './types';
import type { AgentResponse } from './agent-client';
import { EVIDENCE_PREFIXES, evidenceIdsIn, validateRootCause, ValidationIssue, ValidationResult } from './validator';
import { evidenceRegistry } from './data';
export const EVIDENCE_KINDS = ['Trial report', 'Parameter log', 'Inspection record', 'Measurement'] as const;
export type EvidenceKind = typeof EVIDENCE_KINDS[number];
// The synthetic registry in code plus the current-lot evidence engineers registered in this browser.
export function registryOf(state: AppState): EvidenceRecord[] {
    return [...evidenceRegistry, ...(state.evidence ?? [])];
}
export function evidenceFor(state: AppState, id: string): EvidenceRecord[] {
    return registryOf(state).filter(r => r.ncrId === id);
}
// A human action in the UI is the only way to register evidence. The id must have a form the root cause check
// recognises (PREFIX-NNN, see EVIDENCE_PREFIXES) and be unused, since the validator maps each id to one NCR.
export function registerEvidence(state: AppState, ncrId: string, input: { id: string; kind: string; summary: string }, actor: string, now: string): AppState {
    const id = input.id.trim().toUpperCase();
    const summary = input.summary.trim();
    if (!state.ncrs.some(n => n.id === ncrId))
        throw new Error('Unknown NCR ' + ncrId + '.');
    if (!id)
        throw new Error('Enter an evidence id, for example TR-100.');
    if (!/^[A-Z0-9-]+$/.test(id))
        throw new Error('Use only letters, digits and hyphens in the evidence id.');
    if (evidenceIdsIn(id).join() !== id)
        throw new Error('Use an id the root cause check recognises: one of ' + EVIDENCE_PREFIXES.join(', ') + ', a hyphen and at least three digits, for example TR-100.');
    if (!(EVIDENCE_KINDS as readonly string[]).includes(input.kind))
        throw new Error('Choose an evidence type: ' + EVIDENCE_KINDS.join(', ') + '.');
    if (!summary)
        throw new Error('Add a short description of the evidence.');
    const owner = registryOf(state).find(r => r.id.toUpperCase() === id)?.ncrId;
    if (owner)
        throw new Error(id + ' is already registered' + (owner === ncrId ? ' for ' + ncrId : ' to ' + owner) + '. Use a new id.');
    const record: EvidenceRecord = { id, ncrId, kind: input.kind, summary: summary.slice(0, 200), date: now.slice(0, 10) };
    const event: AuditEvent = { id: 'ev-' + ncrId + '-' + id, ncrId, actor, kind: 'Human', action: 'Registered current-lot evidence ' + id + ' (' + input.kind + ').', timestamp: now };
    return { ...state, evidence: [...(state.evidence ?? []), record], audit: [event, ...state.audit] };
}
export class RootCauseRejectedError extends Error {
    readonly issues: ValidationIssue[];
    constructor(issues: ValidationIssue[]) {
        super('Root cause check failed: ' + issues.map(i => i.message).join(' '));
        this.name = 'RootCauseRejectedError';
        this.issues = issues;
    }
}
// Rule D: without registered current-lot evidence the D4 proposal is an unverified hypothesis and cannot be approved.
export class UnverifiedHypothesisError extends Error {
    constructor(id: string) {
        super(d4ApprovalLock(id));
        this.name = 'UnverifiedHypothesisError';
    }
}
export function d4ApprovalLock(id: string) {
    return 'D4 approval is locked: no current-lot evidence is registered for ' + id + ', so the root cause is an unverified hypothesis. Register current-lot evidence (for example a controlled trial report) in the D4 panel first.';
}
export function isD4Locked(state: AppState, id: string) {
    return rootCauseCheck(state, id, '').hypothesisStatus === 'unverified_hypothesis';
}
// Runs the validator on D4 text against the historical NCRs retrieved for the case and the evidence registered to it.
// After an agent proposal, the retrieved set is what the agent's tools returned, not the static seed list.
export function rootCauseCheck(state: AppState, id: string, text: string): ValidationResult {
    const ncr = state.ncrs.find(n => n.id === id);
    const agentRetrieved = state.reports.find(r => r.ncrId === id)?.agentRetrieved;
    const retrieved = agentRetrieved ? agentRetrieved.map(h => h.id) : ncr?.evidence ?? [];
    return validateRootCause(text, retrieved, { currentNcrId: id, evidenceRegistry: registryOf(state) });
}
export function rootCauseAuditAction(step: number, trigger: 'generated' | 'saved' | 'approval', issues: ValidationIssue[]) {
    return 'Root cause check rejected D' + (step + 1) + (trigger === 'approval' ? ' approval' : ' ' + trigger + ' draft') + ': ' + issues.map(i => i.code).join(', ') + '.';
}
export function canAccess(state: AppState, id: string, step: number) { const report = state.reports.find(r => r.ncrId === id); return !!report && report.sections.slice(0, step).every((s, i) => i === 3 || i === 4 ? s.status === 'Approved' : s.status === 'Complete' || s.status === 'Approved'); }
// Disciplines whose Complete or Approved status a new draft at `step` resets: the step itself and every later one.
export function approvalsResetBy(state: AppState, id: string, step: number): number[] {
    const sections = state.reports.find(r => r.ncrId === id)?.sections ?? [];
    return sections.map((s, i) => i >= step && (s.status === 'Complete' || s.status === 'Approved') ? i : -1).filter(i => i >= 0);
}
// A successful agent proposal replaces the D4 draft and revokes later approvals. It never touches state.evidence.
export function withAgentDraft(s: AppState, id: string, step: number, draft: string, r: AgentResponse): AppState {
    return { ...s, reports: s.reports.map(rep => rep.ncrId !== id ? rep : { ...rep, agentRetrieved: r.retrieved, sections: rep.sections.map((x, i): ReportSection => i === step ? { content: draft, status: 'Draft' } : i > step ? { ...x, status: x.content ? 'Draft' : 'Not started', feedback: undefined } : x) }) };
}
// A failed agent call only records the failure; the report and the editor content stay as they were.
export function withAgentFailure(s: AppState, failure: AuditEvent): AppState {
    return { ...s, audit: [failure, ...s.audit] };
}
export function isOverdue(due: string, status: string) { return status !== 'Completed' && due < new Date().toISOString().slice(0, 10); }
export function reviewSection(state: AppState, id: string, step: number, approve: boolean, feedback: string): AppState { if (!canAccess(state, id, step))
    throw new Error('Complete the preceding disciplines first.'); if ((step === 3 || step === 4) && !feedback.trim())
    throw new Error('Record validation evidence or a rejection reason.'); const report = state.reports.find(r => r.ncrId === id); if (!report?.sections[step].content.trim())
    throw new Error('Add report content first.'); if (approve && step === 3) {
    const check = rootCauseCheck(state, id, report.sections[3].content);
    if (!check.ok)
        throw new RootCauseRejectedError(check.issues);
    if (check.hypothesisStatus === 'unverified_hypothesis')
        throw new UnverifiedHypothesisError(id);
} if (step === 7 && state.capas.some(c => c.ncrId === id && c.status !== 'Completed'))
    throw new Error('Complete all linked CAPAs before closing the report.'); return { ...state, reports: state.reports.map(r => r.ncrId !== id ? r : { ...r, sections: r.sections.map((s, i) => i === step ? { ...s, status: approve ? (step === 3 || step === 4 ? 'Approved' : 'Complete') : 'Rejected', feedback } : i > step ? { ...s, status: s.content ? 'Draft' : 'Not started', feedback: undefined } : s) }), ncrs: state.ncrs.map(n => n.id !== id ? n : { ...n, status: approve && step === 7 ? 'Closed' : approve && step === 2 || approve && step === 3 ? 'Pending approval' : 'In progress' }) }; }
