import { Search, Inbox } from 'lucide-react';
export function Badge({ children }: {
    children: React.ReactNode;
}) { const s = String(children).toLowerCase().replaceAll(' ', '-'); return <span className={'badge badge-' + s}>{children}</span>; }
export function PageHeading({ eyebrow, title, description, action }: {
    eyebrow: string;
    title: string;
    description: string;
    action?: React.ReactNode;
}) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>; }
export function SearchBox({ value, onChange, placeholder = 'Search records…' }: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
}) { return <label className="search-box"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/></label>; }
export function Empty({ text = 'No records match your filters.' }: {
    text?: string;
}) { return <div className="empty"><Inbox size={30}/><p>{text}</p></div>; }
export function dateLabel(date: string) { return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
