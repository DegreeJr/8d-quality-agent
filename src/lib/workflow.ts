import { AppState } from './types';
import { validateRootCause, ValidationIssue, ValidationResult } from './validator';
import { evidenceRegistry } from './data';
export class RootCauseRejectedError extends Error {
    readonly issues: ValidationIssue[];
    constructor(issues: ValidationIssue[]) {
        super('Root cause check failed: ' + issues.map(i => i.message).join(' '));
        this.name = 'RootCauseRejectedError';
        this.issues = issues;
    }
}
// Runs the validator on D4 text against the historical NCRs retrieved for the case and the evidence registered to it.
// After an agent proposal, the retrieved set is what the agent's tools returned, not the static seed list.
export function rootCauseCheck(state: AppState, id: string, text: string): ValidationResult {
    const ncr = state.ncrs.find(n => n.id === id);
    const agentRetrieved = state.reports.find(r => r.ncrId === id)?.agentRetrieved;
    const retrieved = agentRetrieved ? agentRetrieved.map(h => h.id) : ncr?.evidence ?? [];
    return validateRootCause(text, retrieved, { currentNcrId: id, evidenceRegistry });
}
export function rootCauseAuditAction(step: number, trigger: 'generated' | 'saved' | 'approval', issues: ValidationIssue[]) {
    return 'Root cause check rejected D' + (step + 1) + (trigger === 'approval' ? ' approval' : ' ' + trigger + ' draft') + ': ' + issues.map(i => i.code).join(', ') + '.';
}
export function canAccess(state: AppState, id: string, step: number) { const report = state.reports.find(r => r.ncrId === id); return !!report && report.sections.slice(0, step).every((s, i) => i === 3 || i === 4 ? s.status === 'Approved' : s.status === 'Complete' || s.status === 'Approved'); }
export function isOverdue(due: string, status: string) { return status !== 'Completed' && due < new Date().toISOString().slice(0, 10); }
export function reviewSection(state: AppState, id: string, step: number, approve: boolean, feedback: string): AppState { if (!canAccess(state, id, step))
    throw new Error('Complete the preceding disciplines first.'); if ((step === 3 || step === 4) && !feedback.trim())
    throw new Error('Record validation evidence or a rejection reason.'); const report = state.reports.find(r => r.ncrId === id); if (!report?.sections[step].content.trim())
    throw new Error('Add report content first.'); if (approve && step === 3) {
    const check = rootCauseCheck(state, id, report.sections[3].content);
    if (!check.ok)
        throw new RootCauseRejectedError(check.issues);
} if (step === 7 && state.capas.some(c => c.ncrId === id && c.status !== 'Completed'))
    throw new Error('Complete all linked CAPAs before closing the report.'); return { ...state, reports: state.reports.map(r => r.ncrId !== id ? r : { ...r, sections: r.sections.map((s, i) => i === step ? { ...s, status: approve ? (step === 3 || step === 4 ? 'Approved' : 'Complete') : 'Rejected', feedback } : i > step ? { ...s, status: s.content ? 'Draft' : 'Not started', feedback: undefined } : s) }), ncrs: state.ncrs.map(n => n.id !== id ? n : { ...n, status: approve && step === 7 ? 'Closed' : approve && step === 2 || approve && step === 3 ? 'Pending approval' : 'In progress' }) }; }
