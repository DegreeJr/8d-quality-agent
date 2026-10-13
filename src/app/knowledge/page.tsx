'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only storage and URL parameters after mount. */
import { useState, useEffect } from 'react';
import { BookOpen, FileCheck2, ArrowUpRight } from 'lucide-react';
import { history } from '@/lib/data';
import { HistoricalCase } from '@/lib/types';
import { PageHeading, SearchBox, Badge, Empty, dateLabel } from '@/components/common';
import { Dialog } from '@/components/ui/dialog';
export default function Knowledge() {
    const [query, setQuery] = useState('');
    const [area, setArea] = useState('All areas');
    const [category, setCategory] = useState('All categories');
    const [selected, setSelected] = useState<HistoricalCase | null>(null);
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('case');
        if (id)
            setSelected(history.find(h => h.id === id) || null);
    }, []);
    const filtered = history.filter(h => (h.id + ' ' + h.title + ' ' + h.rootCause + ' ' + h.action + ' ' + h.evidence).toLowerCase().includes(query.toLowerCase()) && (area === 'All areas' || area === h.area) && (category === 'All categories' || category === h.category));
    return <><PageHeading eyebrow="HISTORICAL QUALITY INTELLIGENCE" title="Knowledge Base" description="Learn from validated past investigations. Build stronger decisions today." action={<span className="muted small">{history.length} reference cases</span>}/><div className="knowledge-banner"><span className="knowledge-icon"><BookOpen size={26}/></span><div><h2>Evidence, before assumptions.</h2><p>Historical cases provide context. Current NCR root causes still require independent engineering validation.</p></div><Badge>Synthetic repository</Badge></div><div className="filter-bar standalone"><SearchBox value={query} onChange={setQuery} placeholder="Search historical cases, root causes, or evidence…"/><select aria-label="Production area filter" value={area} onChange={e => setArea(e.target.value)}>{['All areas', ...new Set(history.map(h => h.area))].map(x => <option key={x}>{x}</option>)}</select><select aria-label="Defect category filter" value={category} onChange={e => setCategory(e.target.value)}>{['All categories', ...new Set(history.map(h => h.category))].map(x => <option key={x}>{x}</option>)}</select></div><div className="knowledge-grid">{filtered.map(h => <button className="card knowledge-card" key={h.id} onClick={() => setSelected(h)}><div className="knowledge-card-top"><span className="record-link">{h.id}</span><ArrowUpRight size={17}/></div><h2>{h.title}</h2><div className="inline"><Badge>{h.category}</Badge><span className="small muted">{h.area}</span></div><div className="knowledge-section"><small>CONFIRMED HISTORICAL CAUSE</small><p>{h.rootCause}</p></div><div className="knowledge-section"><small>CORRECTIVE ACTION</small><p>{h.action}</p></div><div className="knowledge-card-foot"><FileCheck2 size={15}/><span>Evidence referenced</span><small>Closed {dateLabel(h.closed)}</small></div></button>)}</div>{!filtered.length && <Empty />}<Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)} title={selected?.id || 'Historical case'} description={selected?.title}>{selected && <div className="stack"><div className="inline"><Badge>{selected.category}</Badge><Badge>Closed</Badge><span className="muted small">{selected.area}</span></div><div><h3>Historical root cause</h3><p>{selected.rootCause}</p></div><div><h3>Corrective action</h3><p>{selected.action}</p></div><div className="callout"><FileCheck2 size={20}/><span><strong>Evidence references</strong><br />{selected.evidence}</span></div><p className="small muted">These are synthetic reference metadata, not downloadable evidence files. A similar historical case does not verify the cause of an active NCR.</p></div>}</Dialog></>;
}
