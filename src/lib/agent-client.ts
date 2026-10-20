// Typed client for the quality agent (agent/ in this repo). The UI uses it only when
// NEXT_PUBLIC_AGENT_BACKEND=local; otherwise the local simulation stays in place.
import type { EvidenceRecord, NCR } from './types';

export type AgentBackend = 'simulated' | 'local';
// Inlined at build time; must be referenced literally (see Next.js environment variable docs).
export const agentBackend: AgentBackend = process.env.NEXT_PUBLIC_AGENT_BACKEND === 'local' ? 'local' : 'simulated';

export interface AgentRequest {
    action: 'propose_root_cause';
    ncr: { id: string; title: string; description: string; area: string };
    current_evidence: { id: string; ncrId: string }[];
}

export interface AgentProposal {
    root_cause: string | null;
    cited_ncr_ids: string[];
    confidence: 'low' | 'medium' | 'high';
    missing_data: string[];
}

export interface AgentResponse {
    status: 'success';
    mode: string;
    model_id: string | null;
    // Human-readable model name when known, e.g. gpt-5.4 for an SAP AI Core deployment.
    model_name?: string | null;
    ncr_id: string;
    // unverified_hypothesis: no current-lot evidence is registered for the NCR (Rule D).
    proposal_status?: 'unverified_hypothesis' | 'hypothesis_with_current_evidence' | 'no_hypothesis';
    proposal: AgentProposal;
    raw_proposal: AgentProposal | null;
    retrieved: { id: string; score: number | null; title: string }[];
    validation: { ok: boolean; issues: { code: string; message: string }[] };
    accepted: boolean;
}

export class AgentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentError';
    }
}

export function buildAgentRequest(ncr: NCR, registry: readonly EvidenceRecord[]): AgentRequest {
    return {
        action: 'propose_root_cause',
        ncr: { id: ncr.id, title: ncr.title, description: ncr.description, area: ncr.area },
        current_evidence: registry.filter(r => r.ncrId === ncr.id).map(r => ({ id: r.id, ncrId: r.ncrId }))
    };
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
function isProposal(v: unknown): v is AgentProposal {
    const p = v as AgentProposal;
    return !!p && (p.root_cause === null || typeof p.root_cause === 'string') && isStringArray(p.cited_ncr_ids) && ['low', 'medium', 'high'].includes(p.confidence) && isStringArray(p.missing_data);
}

// Checks the shape of an agent response before the UI trusts it.
export function parseAgentResponse(json: unknown): AgentResponse {
    const r = json as AgentResponse & { error?: string };
    if (!r || typeof r !== 'object')
        throw new AgentError('Agent returned an invalid response.');
    if (r.status !== 'success')
        throw new AgentError(typeof r.error === 'string' ? r.error : 'Agent returned an error.');
    if (typeof r.mode !== 'string' || typeof r.ncr_id !== 'string' || (r.model_name !== undefined && r.model_name !== null && typeof r.model_name !== 'string') || (r.proposal_status !== undefined && !['unverified_hypothesis', 'hypothesis_with_current_evidence', 'no_hypothesis'].includes(r.proposal_status)) || typeof r.accepted !== 'boolean' || !isProposal(r.proposal) || !Array.isArray(r.retrieved) || !r.retrieved.every(h => h && typeof h.id === 'string') || !r.validation || !Array.isArray(r.validation.issues))
        throw new AgentError('Agent response does not match the expected shape.');
    return r;
}

export function agentLabel(r: Pick<AgentResponse, 'mode' | 'model_id' | 'model_name'>) {
    if (r.mode === 'mock')
        return 'local agent, mock mode without a model';
    if (r.mode === 'sap')
        return 'SAP AI Core (' + (r.model_name || r.model_id || 'unknown deployment') + ')';
    return r.mode + (r.model_name || r.model_id ? ' ' + (r.model_name || r.model_id) : '');
}

// D4 draft text from an agent response. Rejected proposals become an "evidence missing" draft.
export function agentDraft(r: AgentResponse): string {
    const missing = r.proposal.missing_data.length ? ' Missing data: ' + r.proposal.missing_data.join(' ') : '';
    if (!r.accepted || !r.proposal.root_cause)
        return 'Evidence missing. ' + (r.accepted ? 'The agent (' + agentLabel(r) + ') found no supported hypothesis.' : 'The agent proposal (' + agentLabel(r) + ') was rejected by the root cause check: ' + r.validation.issues.map(i => i.code).join(', ') + '.') + missing;
    const status = r.proposal_status === 'unverified_hypothesis' ? ' Status: unverified hypothesis, no current-lot evidence registered.' : '';
    return 'Agent proposal (' + agentLabel(r) + ', not validated): ' + r.proposal.root_cause + ' Cited: ' + r.proposal.cited_ncr_ids.join(', ') + '. Confidence: ' + r.proposal.confidence + '.' + status + missing;
}

export async function proposeRootCause(request: AgentRequest, fetchImpl: typeof fetch = fetch): Promise<AgentResponse> {
    let res: Response;
    try {
        res = await fetchImpl('/api/agent/root-cause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    }
    catch {
        throw new AgentError('Could not reach the app API.');
    }
    const json: unknown = await res.json().catch(() => null);
    return parseAgentResponse(json);
}
