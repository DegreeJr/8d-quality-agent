'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only storage and URL parameters after mount. */
import { createContext, useContext, useEffect, useState } from 'react';
import { AppState, NCR, CAPA } from '@/lib/types';
import { createInitialState, sectionDraft } from '@/lib/data';
import { reviewSection, canAccess, rootCauseCheck, rootCauseAuditAction } from '@/lib/workflow';
interface Store {
    state: AppState;
    ready: boolean;
    notice: string;
    addNcr: (n: Omit<NCR, 'id' | 'date' | 'evidence' | 'status'>) => string;
    saveSection: (id: string, step: number, content: string) => void;
    generate: (id: string, step: number) => void;
    review: (id: string, step: number, approve: boolean, note: string) => void;
    logSystem: (id: string, action: string) => void;
    updateCapa: (id: string, status: CAPA['status']) => void;
    assignCapa: (c: Omit<CAPA, 'id' | 'escalated'>) => void;
    notify: (s: string) => void;
    reset: () => void;
}
const Context = createContext<Store | null>(null);
const key = '8d-quality-agent-v1';
export function AppProvider({ children }: {
    children: React.ReactNode;
}) {
    const [state, setState] = useState(createInitialState);
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState('');
    useEffect(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved.version === 1 && Array.isArray(saved.ncrs) && Array.isArray(saved.reports) && Array.isArray(saved.capas) && Array.isArray(saved.audit))
                    setState(saved);
            }
        }
        catch {
            setNotice('Saved demo data could not be loaded. Using the original dataset.');
        }
        setReady(true);
    }, []);
    useEffect(() => {
        if (ready)
            try {
                localStorage.setItem(key, JSON.stringify(state));
            }
            catch {
                setNotice('Browser storage is unavailable. Changes will last for this session only.');
            }
    }, [state, ready]);
    useEffect(() => { if (notice) {
        const t = setTimeout(() => setNotice(''), 6000);
        return () => clearTimeout(t);
    } }, [notice]);
    const event = (id: string, action: string, kind: 'AI' | 'Human' | 'System' = 'Human') => ({ id: crypto.randomUUID(), ncrId: id, actor: kind === 'AI' ? 'Quality agent (simulated)' : kind === 'System' ? 'Root cause validator' : 'Sarah Chen', kind, action, timestamp: new Date().toISOString() });
    const validationEvents = (s: AppState, id: string, step: number, content: string, trigger: 'generated' | 'saved') => { if (step !== 3)
        return []; const check = rootCauseCheck(s, id, content); return check.ok ? [] : [event(id, rootCauseAuditAction(step, trigger, check.issues), 'System')]; };
    const store: Store = { state, ready, notice, notify: setNotice,
        addNcr: n => { const id = 'NCR-2026-' + String(Math.max(104, ...state.ncrs.map(x => Number(x.id.split('-').at(-1)))) + 1).padStart(3, '0'); setState(s => ({ ...s, ncrs: [{ ...n, id, date: new Date().toISOString().slice(0, 10), evidence: [], status: 'Open' }, ...s.ncrs], reports: [...s.reports, { ncrId: id, sections: Array.from({ length: 8 }, () => ({ content: '', status: 'Not started' })) }], audit: [event(id, 'Created NCR' + (n.document ? ' with simulated upload: ' + n.document : '.')), ...s.audit] })); setNotice(id + ' created. Ready for an 8D investigation.'); return id; },
        saveSection: (id, step, content) => { setState(s => ({ ...s, reports: s.reports.map(r => r.ncrId !== id ? r : { ...r, sections: r.sections.map((x, i) => i === step ? { content, status: 'Draft' } : i > step ? { ...x, status: x.content ? 'Draft' : 'Not started', feedback: undefined } : x) }), ncrs: s.ncrs.map(n => n.id === id ? { ...n, status: 'In progress' } : n), audit: [...validationEvents(s, id, step, content, 'saved'), event(id, 'Edited D' + (step + 1) + '; downstream approvals require revalidation.'), ...s.audit] })); setNotice('Section saved. Changes invalidate downstream approvals.'); },
        generate: (id, step) => setState(s => { if (!canAccess(s, id, step))
            return s; const n = s.ncrs.find(n => n.id === id)!; const draft = sectionDraft(n, step); return { ...s, reports: s.reports.map(r => r.ncrId !== id ? r : { ...r, sections: r.sections.map((x, i) => i === step ? { content: draft, status: 'Draft' } : i > step ? { ...x, status: x.content ? 'Draft' : 'Not started', feedback: undefined } : x) }), audit: [...validationEvents(s, id, step, draft, 'generated'), event(id, 'Generated simulated D' + (step + 1) + ' suggestion. ' + (n.evidence.length ? 'Historical references retrieved; current cause unvalidated.' : 'Evidence missing.'), 'AI'), ...s.audit] }; }),
        review: (id, step, approve, note) => { setState(s => ({ ...reviewSection(s, id, step, approve, note), audit: [event(id, (approve ? 'Approved' : 'Rejected') + ' D' + (step + 1) + (note ? ': ' + note : '')), ...s.audit] })); setNotice(approve ? 'Human review recorded. Next discipline unlocked.' : 'Draft returned for revision.'); },
        logSystem: (id, action) => setState(s => ({ ...s, audit: [event(id, action, 'System'), ...s.audit] })),
        updateCapa: (id, status) => { setState(s => { const c = s.capas.find(c => c.id === id)!; return { ...s, capas: s.capas.map(c => c.id === id ? { ...c, status } : c), audit: [event(c.ncrId, id + ' status changed to ' + status), ...s.audit] }; }); setNotice('CAPA status updated.'); },
        assignCapa: c => { const id = 'CAPA-' + String(Math.max(42, ...state.capas.map(c => Number(c.id.split('-')[1]))) + 1).padStart(3, '0'); setState(s => ({ ...s, capas: [{ ...c, id, escalated: false }, ...s.capas], audit: [event(c.ncrId, 'Assigned ' + id + ' to ' + c.owner), ...s.audit] })); setNotice('Corrective action assigned.'); },
        reset: () => { setState(createInitialState()); setNotice('Demo reset to the original connected dataset.'); } };
    return <Context.Provider value={store}>{children}{notice && <div className="toast" role="status">{notice}</div>}</Context.Provider>;
}
export function useApp() { const ctx = useContext(Context); if (!ctx)
    throw new Error('App provider missing'); return ctx; }
