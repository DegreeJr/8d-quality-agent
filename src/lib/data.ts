import { AppState, EvidenceRecord, HistoricalCase, NCR } from './types';
export const history: HistoricalCase[] = [
    { id: 'NCR-2025-084', title: 'Porosity in aluminum housing', area: 'Die casting', category: 'Porosity', rootCause: 'Vent channel blockage confirmed by tooling inspection.', action: 'Clean vent channels every 400 cycles; add vent inspection to setup checklist.', evidence: 'Tooling inspection TI-084 · metallography LAB-218', closed: '2025-11-18' },
    { id: 'NCR-2026-019', title: 'Housing voids after tool change', area: 'Die casting', category: 'Porosity', rootCause: 'Incorrect vacuum timing confirmed by parameter log comparison.', action: 'Lock validated vacuum recipe and verify first-off samples.', evidence: 'Parameter log PL-019 · first-off verification FV-019', closed: '2026-03-12' },
    { id: 'NCR-2026-032', title: 'Shaft diameter outside tolerance', area: 'CNC machining', category: 'Dimensional', rootCause: 'Tool wear confirmed by measured insert condition.', action: 'Introduce tool-life limits and in-process gauging.', evidence: 'Gauge study GR-032 · tool inspection TI-032', closed: '2026-05-07' },
    { id: 'NCR-2026-047', title: 'Surface scoring on drive cover', area: 'Assembly', category: 'Surface finish', rootCause: 'Fixture contact point confirmed through controlled reproduction.', action: 'Replace fixture pads and add visual checks.', evidence: 'Trial report TR-047 · fixture photos FP-047', closed: '2026-07-22' },
    { id: 'NCR-2026-061', title: 'Seal leak during end-of-line test', area: 'Assembly', category: 'Leakage', rootCause: 'Seal orientation confirmed by teardown.', action: 'Add poka-yoke locator and operator training.', evidence: 'Teardown TD-061 · validation VT-061', closed: '2026-09-02' }
];
// Synthetic evidence registry. Rule B accepts an evidence id only if it is listed here for the NCR being investigated.
export const evidenceRegistry: EvidenceRecord[] = [
    { id: 'TI-084', ncrId: 'NCR-2025-084', kind: 'Tooling inspection', summary: 'Vent channel condition on the housing die.', date: '2025-11-04' },
    { id: 'LAB-218', ncrId: 'NCR-2025-084', kind: 'Metallography', summary: 'Pore morphology of sectioned housings.', date: '2025-11-06' },
    { id: 'PL-019', ncrId: 'NCR-2026-019', kind: 'Parameter log', summary: 'Vacuum timing before and after the tool change.', date: '2026-03-02' },
    { id: 'FV-019', ncrId: 'NCR-2026-019', kind: 'First-off verification', summary: 'First-off samples after recipe lock.', date: '2026-03-10' },
    { id: 'GR-032', ncrId: 'NCR-2026-032', kind: 'Gauge study', summary: 'Gauge R&R of the shaft diameter gauge.', date: '2026-04-22' },
    { id: 'TI-032', ncrId: 'NCR-2026-032', kind: 'Tooling inspection', summary: 'Measured insert wear at the time of the defect.', date: '2026-04-23' },
    { id: 'TR-047', ncrId: 'NCR-2026-047', kind: 'Trial report', summary: 'Controlled reproduction of scoring on the assembly fixture.', date: '2026-07-10' },
    { id: 'FP-047', ncrId: 'NCR-2026-047', kind: 'Fixture photos', summary: 'Fixture contact pads before replacement.', date: '2026-07-10' },
    { id: 'TD-061', ncrId: 'NCR-2026-061', kind: 'Teardown', summary: 'Teardown of leaking seal assemblies.', date: '2026-08-21' },
    { id: 'VT-061', ncrId: 'NCR-2026-061', kind: 'Validation test', summary: 'Leak test of 30 assemblies with the locator.', date: '2026-08-29' },
    { id: 'TR-104', ncrId: 'NCR-2026-104', kind: 'Trial report', summary: 'Controlled trial on current lot LOT-DC-2410: porosity rate before and after vent cleaning.', date: '2026-10-15' },
    { id: 'PL-104', ncrId: 'NCR-2026-104', kind: 'Parameter log', summary: 'Die-casting cell parameter log for LOT-DC-2410.', date: '2026-10-13' },
    { id: 'GR-103', ncrId: 'NCR-2026-103', kind: 'Gauge study', summary: 'Gauge R&R of the bore gauge used on LOT-CNC-1834.', date: '2026-10-13' },
    { id: 'TI-103', ncrId: 'NCR-2026-103', kind: 'Tooling inspection', summary: 'Insert condition on the turning center for LOT-CNC-1834.', date: '2026-10-13' },
    { id: 'FP-102', ncrId: 'NCR-2026-102', kind: 'Fixture photos', summary: 'Fixture pads at the drive cover station for LOT-AS-0902.', date: '2026-10-12' },
    { id: 'TD-101', ncrId: 'NCR-2026-101', kind: 'Teardown', summary: 'Teardown of leaking units from LOT-AS-0898.', date: '2026-10-11' },
    { id: 'VT-099', ncrId: 'NCR-2026-099', kind: 'Validation test', summary: 'Pilot lot inspection after the deburring change.', date: '2026-10-09' },
    { id: 'TD-098', ncrId: 'NCR-2026-098', kind: 'Teardown', summary: 'Teardown of connectors that failed seating.', date: '2026-10-08' },
    { id: 'LAB-097', ncrId: 'NCR-2026-097', kind: 'Metallography', summary: 'Pore cluster sections from LOT-DC-2380.', date: '2026-10-07' }
];
const rows = [
    ['104', 'Porosity in aluminum motor housing', 'Die casting', 'POR-01', 'Porosity', 'Critical', 'Pending approval', 'Sarah Chen', 48, 'LOT-DC-2410', ['NCR-2025-084', 'NCR-2026-019']],
    ['103', 'Shaft diameter exceeds upper tolerance', 'CNC machining', 'DIM-02', 'Dimensional', 'Major', 'In progress', 'James Wilson', 22, 'LOT-CNC-1834', ['NCR-2026-032']],
    ['102', 'Surface scoring on drive cover', 'Assembly', 'SUR-03', 'Surface finish', 'Minor', 'Open', 'Maria Garcia', 16, 'LOT-AS-0902', ['NCR-2026-047']],
    ['101', 'Pressure leak at seal interface', 'Assembly', 'LEK-01', 'Leakage', 'Critical', 'In progress', 'David Park', 12, 'LOT-AS-0898', ['NCR-2026-061']],
    ['100', 'Coating thickness below specification', 'Coating', 'COT-02', 'Coating', 'Major', 'Open', 'Sarah Chen', 30, 'LOT-CT-1001', []],
    ['099', 'Burrs on mounting hole edges', 'CNC machining', 'BUR-01', 'Surface finish', 'Minor', 'Closed', 'James Wilson', 8, 'LOT-CNC-1801', ['NCR-2026-032']],
    ['098', 'Connector seating failure', 'Assembly', 'ASM-04', 'Assembly', 'Major', 'Closed', 'Maria Garcia', 6, 'LOT-AS-0862', []],
    ['097', 'Die-cast housing pore cluster', 'Die casting', 'POR-01', 'Porosity', 'Major', 'Closed', 'David Park', 24, 'LOT-DC-2380', ['NCR-2025-084']]
];
export const initialNcrs = rows.map((r, i) => ({ id: 'NCR-2026-' + r[0], title: r[1], description: i === 0 ? 'X-ray inspection detected internal porosity on 48 of 320 aluminum motor housings. Pore clusters exceed the 1.5 mm acceptance limit near the mounting boss. Affected batch is on hold pending investigation.' : 'Inspection identified a non-conformance against the approved product specification. Affected units have been segregated for engineering review.', area: r[2], code: r[3], category: r[4], severity: r[5], status: r[6], owner: r[7], quantity: r[8], lot: r[9], evidence: r[10], date: '2026-10-' + String(13 - i).padStart(2, '0') }) as NCR);
export function sectionDraft(n: NCR, d: number): string {
    const suggestions = [
        'Lead: ' + n.owner + '. Team: quality engineering, production supervisor, process engineering, and inspection. Confirm availability and assign responsibilities.',
        n.description + ' Area: ' + n.area + '. Defect code: ' + n.code + '. Affected quantity: ' + n.quantity + '. Lot: ' + n.lot + '. Confirm specification and measurement records.',
        'Segregate lot ' + n.lot + ' and block shipment. Screen adjacent lots using the approved inspection method. Record disposition and containment effectiveness.',
        n.evidence.length ? 'Candidate precedents (historical, not validated): ' + n.evidence.map(id => { const h = history.find(h => h.id === id); return h ? id + ' (' + h.title + '; recorded cause: ' + h.rootCause + ')' : id; }).join('; ') + '. Hypothesis for investigation: compare process setup, tooling condition, and inspection records with these historical cases. Similarity alone does not establish the current root cause. Validate with controlled trials and current-lot evidence.' : 'Evidence missing. No relevant historical case was retrieved. Collect process logs, inspection results, and a controlled reproduction before selecting a root cause.',
        'Suggested action: review the confirmed cause, introduce a controlled process check, and validate with a pilot lot. Define owner, acceptance criteria, and due date before approval.',
        'Implement the approved action on a pilot lot. Record test results against acceptance criteria. Human review of objective evidence is required before completing validation.',
        'Update the control plan and work instructions. Train operators, extend checks to similar processes, and schedule a 30-day effectiveness review.',
        'Record the team contribution and lessons learned. Confirm all CAPAs are complete and archive the validated report.'
    ];
    return suggestions[d];
}
export function createInitialState(): AppState {
    return { version: 1, ncrs: initialNcrs, reports: initialNcrs.map(n => ({ ncrId: n.id, sections: Array.from({ length: 8 }, (_, d) => ({ content: d < 4 || n.status === 'Closed' ? sectionDraft(n, d) : '', status: n.status === 'Closed' ? (d === 3 || d === 4 ? 'Approved' : 'Complete') : d < 3 ? 'Complete' : d === 3 ? 'Draft' : 'Not started' })) })), capas: [
            { id: 'CAPA-042', ncrId: 'NCR-2026-104', title: 'Inspect vent channels and validate process settings', description: 'Investigate tooling and process parameters. Record objective findings; do not implement a permanent process change until D5 approval.', owner: 'Sarah Chen', due: '2026-10-12', priority: 'Critical', status: 'In progress', escalated: true },
            { id: 'CAPA-041', ncrId: 'NCR-2026-103', title: 'Introduce tool-life monitoring', description: 'Verify insert wear and establish a validated tool replacement interval.', owner: 'James Wilson', due: '2026-10-16', priority: 'Major', status: 'In progress', escalated: false },
            { id: 'CAPA-040', ncrId: 'NCR-2026-101', title: 'Validate seal assembly fixture', description: 'Run controlled validation with leak testing on 30 assemblies.', owner: 'David Park', due: '2026-10-10', priority: 'Critical', status: 'Not started', escalated: true },
            { id: 'CAPA-039', ncrId: 'NCR-2026-102', title: 'Review fixture contact surfaces', description: 'Inspect and replace worn pads, then verify surface finish.', owner: 'Maria Garcia', due: '2026-10-19', priority: 'Minor', status: 'Not started', escalated: false },
            { id: 'CAPA-038', ncrId: 'NCR-2026-099', title: 'Verify deburring operation', description: 'Inspection accepted all pilot lot samples.', owner: 'James Wilson', due: '2026-10-06', priority: 'Minor', status: 'Completed', escalated: false }
        ], audit: [
            { id: 'a1', ncrId: 'NCR-2026-104', actor: 'Analysis agent (simulated)', kind: 'AI', action: 'Generated D4 draft; retrieved 2 historical references. Root cause remains unvalidated.', timestamp: '2026-10-13T08:42:00Z' },
            { id: 'a2', ncrId: 'NCR-2026-104', actor: 'Sarah Chen', kind: 'Human', action: 'Completed D3 containment: affected batch held.', timestamp: '2026-10-13T08:30:00Z' },
            { id: 'a3', ncrId: 'NCR-2026-104', actor: 'Classification agent (simulated)', kind: 'AI', action: 'Suggested classification: Porosity · POR-01.', timestamp: '2026-10-13T08:20:00Z' },
            { id: 'a4', ncrId: 'NCR-2026-104', actor: 'Sarah Chen', kind: 'Human', action: 'Created NCR and assigned the investigation team.', timestamp: '2026-10-13T08:15:00Z' },
            { id: 'a5', ncrId: 'NCR-2026-101', actor: 'Workflow monitor', kind: 'System', action: 'Escalated overdue CAPA-040 to the quality lead.', timestamp: '2026-10-12T09:00:00Z' },
            { id: 'a6', ncrId: 'NCR-2026-103', actor: 'James Wilson', kind: 'Human', action: 'Assigned CAPA-041 for tool-life monitoring.', timestamp: '2026-10-11T10:00:00Z' }
        ] };
}
