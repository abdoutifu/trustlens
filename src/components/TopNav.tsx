import { Bell, CircleHelp, ShieldCheck, UserRound } from 'lucide-react';
import type { Role, Tab } from '../data/scenario';
import { permissions } from '../lib/scoring';
export const tabs: Tab[] = ['Decision', 'Verified cards', 'Audit Trail', 'Compliance Rules'];
export function TopNav({ tab, role, onTab, onRole, notify }: { tab: Tab; role: Role; onTab: (t: Tab) => void; onRole: (r: Role) => void; notify: (s: string) => void }) {
  return <header className="top-nav"><a className="brand" href="#main" aria-label="TrustLens, skip to main content"><span className="brand-mark"><ShieldCheck size={25} /></span>TrustLens</a>
    <nav aria-label="Main navigation" className="top-tabs">{tabs.filter(t => t !== 'Audit Trail' || permissions(role).canViewAudit).map(t => <button key={t} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => onTab(t)}>{t}</button>)}</nav>
    <div className="nav-tools"><span className="demo-tag"><span />Demo mode</span><label className="role-control"><ShieldCheck size={19} /><span className="sr-only">Role</span><select name="role" aria-label="Role" value={role} onChange={e => onRole(e.target.value as Role)}>{(['Reader', 'Reviewer', 'Admin'] as Role[]).map(r => <option key={r} value={r}>Role: {r}</option>)}</select></label>
    <button className="icon-button" aria-label="Help" onClick={() => notify('Select a source to inspect its claim and trust factors. Reviewers can validate or escalate; Admins can inspect the audit trail.')}><CircleHelp /></button>
    <button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You are up to date. This review contains one policy conflict.')}><Bell /><span className="notification-dot" /></button>
    <button className="avatar" aria-label="Current profile" onClick={() => notify(`Alex Morgan · ${role} · Acme NV`)}><UserRound size={22} /></button></div></header>;
}
