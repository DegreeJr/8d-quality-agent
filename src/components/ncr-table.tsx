import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { NCR } from '@/lib/types';
import { Badge, Empty, dateLabel } from './common';
export function NcrTable({ records, onSelect }: {
    records: NCR[];
    onSelect?: (n: NCR) => void;
}) { if (!records.length)
    return <Empty />; return <div className="table-scroll"><table><thead><tr><th>NCR / Description</th><th>Production area</th><th>Severity</th><th>Status</th><th>Assigned to</th><th>Created</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{records.map(n => <tr key={n.id}><td>{onSelect ? <button className="record-link" onClick={() => onSelect(n)}>{n.id}</button> : <Link className="record-link" href={'/ncr?case=' + n.id}>{n.id}</Link>}<div className="table-description">{n.title}</div></td><td>{n.area}</td><td><Badge>{n.severity}</Badge></td><td><Badge>{n.status}</Badge></td><td><span className="mini-avatar">{n.owner.split(' ').map(x => x[0]).join('')}</span>{n.owner}</td><td className="muted">{dateLabel(n.date)}</td><td><Link className="icon-button" href={'/workspace?case=' + n.id} aria-label={'Open 8D for ' + n.id}><ArrowUpRight size={17}/></Link></td></tr>)}</tbody></table></div>; }
