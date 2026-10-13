export type Severity = 'Critical' | 'Major' | 'Minor';
export type NcrStatus = 'Open' | 'In progress' | 'Pending approval' | 'Closed';
export type StepStatus = 'Not started' | 'Draft' | 'Rejected' | 'Approved' | 'Complete';
export interface NCR {
    id: string;
    title: string;
    description: string;
    area: string;
    code: string;
    category: string;
    severity: Severity;
    status: NcrStatus;
    owner: string;
    date: string;
    quantity: number;
    lot: string;
    document?: string;
    evidence: string[];
}
export interface ReportSection {
    content: string;
    status: StepStatus;
    feedback?: string;
}
export interface Report {
    ncrId: string;
    sections: ReportSection[];
}
export interface CAPA {
    id: string;
    ncrId: string;
    title: string;
    description: string;
    owner: string;
    due: string;
    priority: Severity;
    status: 'Not started' | 'In progress' | 'Completed';
    escalated: boolean;
}
export interface HistoricalCase {
    id: string;
    title: string;
    area: string;
    category: string;
    rootCause: string;
    action: string;
    evidence: string;
    closed: string;
}
export interface AuditEvent {
    id: string;
    ncrId: string;
    actor: string;
    kind: 'AI' | 'Human' | 'System';
    action: string;
    timestamp: string;
}
export interface AppState {
    version: 1;
    ncrs: NCR[];
    reports: Report[];
    capas: CAPA[];
    audit: AuditEvent[];
}
export const disciplines = ['Establish the Team', 'Describe the Problem', 'Interim Containment', 'Identify Root Causes', 'Permanent Corrective Actions', 'Implement & Validate', 'Prevent Recurrence', 'Recognize the Team'];
