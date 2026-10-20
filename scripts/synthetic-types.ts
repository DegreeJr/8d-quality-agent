import type { Severity } from '../src/lib/types';

export type Area = 'Die casting' | 'CNC machining' | 'Assembly' | 'Coating';

// A closed historical NCR in the synthetic corpus.
export interface SyntheticNcr {
    id: string;
    title: string;
    description: string;
    area: Area;
    defectCode: string;
    category: string;
    severity: Severity;
    lot: string;
    quantity: number;
    containment: string;
    confirmedRootCause: string;
    // Root cause family label; the ground truth for retrieval evaluation.
    rootCauseCode: string;
    correctiveAction: string;
    evidenceIds: string[];
    closedDate: string;
    language: 'en' | 'id';
}

// A held-out NCR: the query is what an engineer has at D4, the known root cause is the answer.
export interface EvalCase {
    id: string;
    query: string;
    area: Area;
    knownRootCauseCode: string;
    knownRootCause: string;
}
