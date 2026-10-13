'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only storage and URL parameters after mount. */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Plus, UploadCloud, FileText, ArrowUpRight } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { PageHeading, SearchBox, Badge } from '@/components/common';
import { NcrTable } from '@/components/ncr-table';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NCR, Severity } from '@/lib/types';
export default function NcrPage() {
    const { state, addNcr } = useApp();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('All statuses');
    const [severity, setSeverity] = useState('All severities');
    const [create, setCreate] = useState(false);
    const [selected, setSelected] = useState<NCR | null>(null);
    const [file, setFile] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        if (p.has('new'))
            setCreate(true);
        if (p.get('case'))
            setSelected(state.ncrs.find(n => n.id === p.get('case')) || null);
    }, [state.ncrs]);
    const records = state.ncrs.filter(n => (n.id + ' ' + n.title + ' ' + n.area + ' ' + n.code).toLowerCase().includes(query.toLowerCase()) && (status === 'All statuses' || n.status === status) && (severity === 'All severities' || n.severity === severity));
    async function upload(f: File | undefined) { if (!f)
        return; setError(''); if (!/.(pdf|txt|docx)$/i.test(f.name) || f.size > 10 * 1024 * 1024) {
        setError('Use a PDF, TXT, or DOCX smaller than 10 MB.');
        return;
    } setUploading(true); await new Promise(r => setTimeout(r, 900)); setFile(f.name); setUploading(false); }
    function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const title = String(f.get('title')).trim(), description = String(f.get('description')).trim(); if (title.length < 5 || description.length < 20) {
        setError('Use a title of at least 5 characters and a description of at least 20 characters.');
        return;
    } const payload = { title, description, area: String(f.get('area')), code: String(f.get('code')).trim(), category: String(f.get('category')), severity: String(f.get('severity')) as Severity, owner: String(f.get('owner')), quantity: Number(f.get('quantity')), lot: String(f.get('lot')).trim(), document: file || undefined }; const id = addNcr(payload); setCreate(false); setFile(''); window.history.replaceState(null, '', '/ncr'); setSelected({ ...payload, id, date: new Date().toISOString().slice(0, 10), status: 'Open', evidence: [] }); }
    return <><PageHeading eyebrow="NON-CONFORMANCE MANAGEMENT" title="NCR Management" description="Capture, classify, and investigate quality issues in one place." action={<Button onClick={() => { setCreate(true); setError(''); }}><Plus size={16}/>New NCR</Button>}/><div className="summary-strip"><span><strong>{state.ncrs.length}</strong> Total records</span><span><i className="dot-orange"/><strong>{state.ncrs.filter(n => n.status === 'Open').length}</strong> Open</span><span><i className="dot-blue"/><strong>{state.ncrs.filter(n => n.status === 'In progress').length}</strong> In progress</span><span><i className="dot-purple"/><strong>{state.ncrs.filter(n => n.status === 'Pending approval').length}</strong> Awaiting review</span></div><section className="card"><div className="filter-bar"><SearchBox value={query} onChange={setQuery} placeholder="Search case, defect, or production area…"/><select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses', 'Open', 'In progress', 'Pending approval', 'Closed'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Filter severity" value={severity} onChange={e => setSeverity(e.target.value)}>{['All severities', 'Critical', 'Major', 'Minor'].map(s => <option key={s}>{s}</option>)}</select></div><NcrTable records={records} onSelect={setSelected}/><div className="card-foot">Showing {records.length} of {state.ncrs.length} records</div></section><Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)} title={selected?.id || 'NCR detail'} description={selected?.title}>{selected && <div className="stack"><div className="inline"><Badge>{selected.status}</Badge><Badge>{selected.severity}</Badge></div><p>{selected.description}</p><div className="detail-grid">{[['Production area', selected.area], ['Defect classification', selected.category + ' · ' + selected.code], ['Assigned engineer', selected.owner], ['Affected quantity', selected.quantity + ' units'], ['Lot number', selected.lot], ['Document', selected.document || 'Text-based submission']].map(([k, v]) => <div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div><div className="callout">{selected.evidence.length ? selected.evidence.length + ' historical references available for investigation.' : 'Evidence missing: collect inspection and process records before validating a root cause.'}</div><Button asChild><Link href={'/workspace?case=' + selected.id}><ArrowUpRight size={16}/>Open associated 8D report</Link></Button></div>}</Dialog><Dialog open={create} onOpenChange={setCreate} title="Create a non-conformance" description="Record the observed issue. Uploaded documents are simulated and are not parsed."><form className="stack" onSubmit={submit}><label>Problem title<input name="title" required minLength={5} maxLength={120} placeholder="e.g. Porosity in aluminum motor housing"/></label><label>Problem description<textarea name="description" required minLength={20} rows={3} placeholder="What happened, where, when, and how many units are affected?"/></label><div className="form-grid"><label>Production area<select name="area">{['Die casting', 'CNC machining', 'Assembly', 'Coating'].map(x => <option key={x}>{x}</option>)}</select></label><label>Severity<select name="severity">{['Major', 'Critical', 'Minor'].map(x => <option key={x}>{x}</option>)}</select></label><label>Defect category<select name="category">{['Porosity', 'Dimensional', 'Surface finish', 'Leakage', 'Coating', 'Assembly', 'Unclassified'].map(x => <option key={x}>{x}</option>)}</select></label><label>Defect code<input name="code" required placeholder="POR-01"/></label><label>Lot / batch number<input name="lot" required placeholder="LOT-DC-2411"/></label><label>Affected quantity<input name="quantity" type="number" min={1} max={1000000} defaultValue={1} required/></label><label className="span-two">Assigned engineer<select name="owner">{['Sarah Chen', 'James Wilson', 'Maria Garcia', 'David Park'].map(x => <option key={x}>{x}</option>)}</select></label></div><label className="upload-zone"><UploadCloud size={25}/><strong>{uploading ? 'Simulating document upload…' : file || 'Attach a supporting document'}</strong><span>PDF, TXT, DOCX · Max 10 MB · Simulation only</span><input type="file" accept=".pdf,.txt,.docx" disabled={uploading} onChange={e => upload(e.target.files?.[0])}/></label>{file && <span className="text-link"><FileText size={14}/>{file}<button type="button" onClick={() => setFile('')}>Remove</button></span>}{error && <p className="error" role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setCreate(false)}>Cancel</Button><Button type="submit" disabled={uploading}>Create NCR</Button></div></form></Dialog></>;
}
