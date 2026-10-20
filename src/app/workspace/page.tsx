'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only storage and URL parameters after mount. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Lock, Sparkles, ShieldCheck, Save, ChevronRight, ArrowUpRight, Send, FileSearch, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, PageHeading } from '@/components/common';
import { disciplines } from '@/lib/types';
import { evidenceRegistry, history } from '@/lib/data';
import { canAccess, d4ApprovalLock, isD4Locked, reviewSection, rootCauseCheck, rootCauseAuditAction, RootCauseRejectedError, UnverifiedHypothesisError } from '@/lib/workflow';
import { ValidationResult } from '@/lib/validator';
import { agentBackend } from '@/lib/agent-client';
// Live result of the root cause validator for the D4 editor text.
function RootCauseCheck({ result, ncrId }: {
    result: ValidationResult;
    ncrId: string;
}) {
    const registered = evidenceRegistry.filter(r => r.ncrId === ncrId);
    return <section className={'root-cause-check ' + (result.ok ? 'pass' : 'fail')} aria-live="polite" aria-label="Root cause check">
        <header>{result.ok ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}Root cause check: {result.ok ? 'pass' : 'fail'}</header>
        {result.ok
            ? <p>Citations are retrieved cases, no unsupported generic claims, and missing evidence is stated where needed.</p>
            : <ul>{result.issues.map((issue, i) => <li key={i}><code>{issue.code}</code> {issue.message}</li>)}</ul>}
        {result.hypothesisStatus === 'unverified_hypothesis' && <p><strong>Status: unverified hypothesis.</strong> No current-lot evidence is registered, so the text must not call the root cause confirmed and D4 approval is locked.</p>}
        <small>Registered current-lot evidence for {ncrId}: {registered.length ? registered.map(r => r.id + ' (' + r.kind + ')').join(', ') : 'none'}.</small>
        <small>Checks the editor text as you type. Approval checks the saved content.</small>
    </section>;
}
function Editor({ id, step, content, locked, onGenerate, busy, check, onDirtyChange }: {
    id: string;
    step: number;
    content: string;
    locked: boolean;
    onGenerate: () => void;
    busy: boolean;
    check?: (text: string) => ValidationResult;
    onDirtyChange: (dirty: boolean) => void;
}) { const { saveSection } = useApp(); const [draft, setDraft] = useState(content); const dirty = draft !== content; return <><div className="editor-toolbar"><span><FileSearch size={16}/> D{step + 1} report content</span><span>{dirty ? 'Unsaved changes' : 'Saved to browser'}</span></div><textarea className="report-editor" aria-label={'D' + (step + 1) + ' report content'} value={draft} disabled={locked || busy} onChange={e => { setDraft(e.target.value); onDirtyChange(e.target.value !== content); }} placeholder="Generate a simulated suggestion or enter your engineering findings here…"/>{check && <RootCauseCheck result={check(draft)} ncrId={id}/>}<div className="editor-actions"><Button variant="outline" disabled={locked || busy} onClick={onGenerate}>{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {busy ? 'Analyzing case…' : 'Generate AI suggestion'}</Button><Button disabled={locked || busy || !dirty || !draft.trim()} onClick={() => saveSection(id, step, draft)}><Save size={16}/>Save changes</Button></div>{dirty && <p className="small muted">Save your edits before reviewing. Approval applies to the saved report content.</p>}</>; }
export default function Workspace() {
    const { state, generate, generateWithAgent, review, notify, logSystem } = useApp();
    const [id, setId] = useState('NCR-2026-104');
    const [step, setStep] = useState(3);
    const [busy, setBusy] = useState(false);
    const [approval, setApproval] = useState<'approve' | 'reject' | null>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<{
        q: string;
        a: string;
    }[]>([]);
    const [replying, setReplying] = useState(false);
    // Key of the editor instance holding unsaved edits. Saving changes the key, which clears it.
    const [dirtyKey, setDirtyKey] = useState<string | null>(null);
    useEffect(() => {
        const p = new URLSearchParams(window.location.search).get('case');
        if (p) {
            setId(p);
            setStep(0);
        }
    }, []);
    const n = state.ncrs.find(n => n.id === id) || state.ncrs[0];
    const report = state.reports.find(r => r.ncrId === n.id)!;
    const section = report.sections[step];
    const accessible = canAccess(state, n.id, step);
    const evidence = history.filter(h => n.evidence.includes(h.id));
    const complete = report.sections.filter(s => s.status === 'Complete' || s.status === 'Approved').length;
    const approved = section.status === 'Approved' || section.status === 'Complete';
    const editorKey = n.id + '-' + step + '-' + section.content;
    const dirty = dirtyKey === editorKey;
    const d4Locked = step === 3 && isD4Locked(state, n.id);
    async function simulate() { setBusy(true); const target = n.id, index = step; if (agentBackend === 'local' && index === 3) {
        await generateWithAgent(target, index);
        setBusy(false);
        return;
    } await new Promise(r => setTimeout(r, 1400)); generate(target, index); setBusy(false); notify('Simulated draft ready. Review and validate before approval.'); }
    function decide() { try {
        reviewSection(state, n.id, step, approval === 'approve', note);
        review(n.id, step, approval === 'approve', note);
        setApproval(null);
        setNote('');
    }
    catch (e) {
        if (e instanceof RootCauseRejectedError)
            logSystem(n.id, rootCauseAuditAction(step, 'approval', e.issues));
        if (e instanceof UnverifiedHypothesisError)
            logSystem(n.id, 'D4 approval blocked: unverified hypothesis, no current-lot evidence registered.');
        setError((e as Error).message);
    } }
    async function ask(e: React.FormEvent) { e.preventDefault(); if (!question.trim())
        return; const q = question; setQuestion(''); setReplying(true); const answer = evidence.length ? 'For ' + n.id + ', ' + evidence.map(h => h.id).join(' and ') + ' provide historical context. They do not confirm the current cause. Compare current-lot process logs and inspection results, then run a controlled trial. Record the validation evidence in D4 before approving D5.' : 'No supporting historical evidence is available for ' + n.id + '. Gather current inspection results, process parameters, and controlled trial data. A root cause cannot be verified from this submission alone.'; await new Promise(r => setTimeout(r, 850)); setMessages(m => [...m, { q, a: answer }]); setReplying(false); }
    return <><PageHeading eyebrow="HUMAN-LED · AI-ASSISTED" title="AI 8D Workspace" description="Turn quality signals into structured, evidence-based action." action={<span className="simulation-label"><Sparkles size={14}/>{agentBackend === 'local' ? 'Agent API (local) · D4 only' : 'Simulated AI'}</span>}/><div className="workspace-casebar"><select aria-label="Select NCR" disabled={busy} value={n.id} onChange={e => { setId(e.target.value); setStep(0); setMessages([]); }}>{state.ncrs.map(n => <option key={n.id} value={n.id}>{n.id} · {n.title}</option>)}</select><Badge>{n.status}</Badge><Link href={'/ncr?case=' + n.id} className="text-link">View NCR <ArrowUpRight size={14}/></Link></div><div className="workspace-grid"><aside className="card discipline-panel"><div className="discipline-heading"><h2>8D workflow</h2><span>{complete}/8 completed</span><div className="progress-track"><i style={{ width: complete / 8 * 100 + '%' }}/></div></div><nav className="discipline-nav">{disciplines.map((title, i) => { const done = report.sections[i].status === 'Complete' || report.sections[i].status === 'Approved'; const available = canAccess(state, n.id, i); return <button key={title} disabled={busy} className={(step === i ? 'selected ' : '') + (done ? 'done' : '')} onClick={() => setStep(i)}><span className="step-circle">{done ? <Check size={14}/> : 'D' + (i + 1)}</span><span>{title}<small>{done ? 'Completed' : !available ? 'Locked' : report.sections[i].status}</small></span>{!available && <Lock size={12}/>}</button>; })}</nav><div className="workflow-policy"><ShieldCheck size={20}/><strong>Human approval gates</strong><p>D4 and D5 require explicit review and recorded validation evidence.</p></div></aside><section className="card workspace-editor"><div className="workspace-title"><div><span className="eyebrow">DISCIPLINE {step + 1} OF 8</span><h2>{disciplines[step]}</h2></div><Badge>{section.status}</Badge></div><div className="case-summary"><span>{n.id}<Badge>{n.severity}</Badge></span><h3>{n.title}</h3><p>{n.area} · {n.code} · {n.quantity} affected units · {n.lot}</p></div>{!accessible && <div className="callout warning"><Lock size={17}/><span>Complete the preceding disciplines. D4 and D5 must be human-approved before proceeding.</span></div>}{(step === 3 || step === 4) && <div className="callout blue-callout"><ShieldCheck size={18}/><span>{approved ? 'Human review recorded.' : 'Human validation required.'} AI-generated content is a suggestion until supported and approved.</span></div>}{step === 3 && !evidence.length && <div className="callout warning"><AlertCircle size={18}/><span>Evidence missing. No historical evidence is available for this case. Do not treat any hypothesis as a verified root cause.</span></div>}<Editor key={editorKey} onDirtyChange={d => setDirtyKey(d ? editorKey : null)} id={n.id} step={step} content={section.content} locked={!accessible} busy={busy} onGenerate={simulate} check={step === 3 ? text => rootCauseCheck(state, n.id, text) : undefined}/>{section.feedback && <div className="review-note"><strong>Human review record</strong><p>{section.feedback}</p></div>}<div className="approval-box"><div><ShieldCheck size={19}/><span><strong>{step === 3 || step === 4 ? 'Engineering approval' : 'Discipline review'}</strong><small>{approved ? 'Reviewed by Sarah Chen · Demo engineer' : d4Locked ? d4ApprovalLock(n.id) : dirty ? 'Save changes first' : 'Review the saved content before continuing.'}</small></span></div><div className="inline"><Button variant="outline" disabled={!accessible || busy || !section.content} onClick={() => { setApproval('reject'); setNote(''); setError(''); }}>Request revision</Button><Button disabled={!accessible || busy || !section.content || approved || dirty || d4Locked} title={d4Locked ? d4ApprovalLock(n.id) : dirty ? 'Save changes first' : undefined} onClick={() => { setApproval('approve'); setNote(''); setError(''); }}><Check size={16}/>{step === 3 || step === 4 ? 'Approve' : 'Complete'}</Button></div></div>{approved && step < 7 && <Button variant="ghost" className="next-step" onClick={() => setStep(step + 1)}>Continue to D{step + 2}<ChevronRight size={16}/></Button>}{step === 7 && <p className="small muted">The report can close only after all associated CAPAs are completed.</p>}<div className="simulation-disclaimer"><Sparkles size={14}/> Demo processing uses predefined suggestions. No real AI inference.</div></section><aside className="workspace-context"><section className="card"><div className="card-header"><div><h2><Sparkles size={16}/> Agent timeline</h2><p>Simulated workflow activity</p></div></div><div className="context-timeline">{state.audit.filter(a => a.ncrId === n.id).slice(0, 4).map(a => <div key={a.id}><span className={'timeline-point ' + (a.kind === 'AI' ? 'ai' : '')}>{a.kind === 'AI' ? <Sparkles size={12}/> : <CheckCircle2 size={12}/>}</span><p>{a.action}<small>{a.kind === 'AI' ? 'Simulated AI' : a.kind} · {new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small></p></div>)}</div></section><section className="card"><div className="card-header"><div><h2><FileSearch size={16}/> Historical evidence</h2><p>Reference cases · {report.agentRetrieved ? report.agentRetrieved.length + ' retrieved by agent tools' : evidence.length + ' retrieved'}</p></div></div><div className="evidence-list">{report.agentRetrieved ? (report.agentRetrieved.length ? report.agentRetrieved.map(h => <div key={h.id} className="evidence-item"><span>{h.id}</span><strong>{h.title}</strong><small>Retrieved by agent tools{h.score !== null ? ' · score ' + h.score : ''} · historical, not validated</small></div>) : <div className="callout warning">Evidence missing. The agent retrieved no historical NCR.</div>) : evidence.length ? evidence.map(h => <Link key={h.id} href={'/knowledge?case=' + h.id} className="evidence-item"><span>{h.id}<ArrowUpRight size={13}/></span><strong>{h.title}</strong><p>{h.rootCause}</p><small>Historical evidence · not current-case validation</small></Link>) : <div className="callout warning">Evidence missing. Gather current-lot records before validating a hypothesis.</div>}</div></section><section className="card assistant-card"><div className="card-header"><div><h2><Sparkles size={16}/> Case assistant</h2><p>Contextual guidance · simulation</p></div></div><div className="assistant-messages"><p className="assistant-bubble">I can outline what evidence to collect for {n.id}. All replies are simulated guidance.</p>{messages.map((m, i) => <div key={i}><p className="user-bubble">{m.q}</p><p className="assistant-bubble">{m.a}</p></div>)}{replying && <p className="muted">Preparing simulated guidance…</p>}</div><form onSubmit={ask} className="assistant-input"><input aria-label="Ask case assistant" placeholder="Ask about this case…" value={question} onChange={e => setQuestion(e.target.value)}/><button aria-label="Send question" disabled={replying || !question.trim()}><Send size={16}/></button></form></section></aside></div><Dialog open={!!approval} onOpenChange={v => !v && setApproval(null)} title={(approval === 'approve' ? 'Approve' : 'Request revision for') + ' D' + (step + 1)} description={approval === 'approve' ? 'You are recording a human engineering decision for the saved report.' : 'Give the engineer a clear reason for revision.'}><div className="stack">{approval === 'approve' && (step === 3 || step === 4) && <div className="callout warning">Confirm you reviewed objective validation evidence. Historical similarity and simulated suggestions alone do not establish a verified current cause.</div>}<label>{approval === 'approve' ? 'Validation evidence / review notes' : 'Reason for revision'}<textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Record trial IDs, inspection results, or the reason for rejection…"/></label>{error && <p className="error" role="alert">{error}</p>}<div className="dialog-actions"><Button variant="outline" onClick={() => setApproval(null)}>Cancel</Button><Button onClick={decide}>{approval === 'approve' ? 'Confirm human approval' : 'Return for revision'}</Button></div></div></Dialog></>;
}
