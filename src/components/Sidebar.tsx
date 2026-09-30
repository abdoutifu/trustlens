import { BadgeCheck, Gavel, History, MessageSquareText } from 'lucide-react';
import type { Role, Tab } from '../data/scenario';
import { permissions } from '../lib/scoring';
const sections = [{ tab: 'Decision', label: 'Active Queue', icon: MessageSquareText }, { tab: 'Verified cards', label: 'Verified Batch', icon: BadgeCheck }, { tab: 'Audit Trail', label: 'Audit Logs', icon: History }, { tab: 'Compliance Rules', label: 'Rules & Policy', icon: Gavel }] as const;
export function Sidebar({ tab, onTab, role, entries }: { tab: Tab; onTab: (t: Tab) => void; role: Role; entries: number }) {
  return <aside className="sidebar"><div><p className="eyebrow sidebar-label">Payroll review</p><nav aria-label="Review sections">{sections.filter(s => s.tab !== 'Audit Trail' || permissions(role).canViewAudit).map(({ tab: target, label, icon: Icon }) => <button key={target} className={tab === target ? 'selected' : ''} aria-current={tab === target ? 'page' : undefined} onClick={() => onTab(target)}><Icon size={22} />{label}</button>)}</nav></div>
  <div className="sidebar-footer"><div><span>Trust Integrity</span><strong>Audit log: {entries} entries</strong></div><div className="integrity-line" /></div></aside>;
}
