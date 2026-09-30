import { Bell, CircleHelp, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import type { Session, Tab } from '../data/scenario';
export const tabs: Tab[] = ['Decision', 'Verified cards', 'Audit Trail', 'Compliance Rules'];
export function TopNav({ tab, session, onTab, onLogout, notify, status }: { tab: Tab; session: Session; onTab: (t: Tab) => void; onLogout: () => void; notify: (s: string) => void; status: string }) {
  return <header className="top-nav"><a className="brand" href="#main" aria-label="TrustLens, skip to main content"><span className="brand-mark"><ShieldCheck size={25} /></span>TrustLens</a>
    <nav aria-label="Main navigation" className="top-tabs">{tabs.filter(t => t !== 'Audit Trail' || session.capabilities.canViewAudit).map(t => <button key={t} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => onTab(t)}>{t}</button>)}</nav>
    <div className="nav-tools"><span className="demo-tag">Local demo</span><span className="session-label"><UserRound size={18} />{session.name} · {session.role}</span><button className="icon-button" aria-label="Help" onClick={() => notify('Compare current clauses, review their trust factors, then validate or escalate. Use the Demo guide for a walkthrough.')}><CircleHelp /></button><button className="icon-button" aria-label="Review status" onClick={() => notify(status)}><Bell /></button><button className="icon-button" aria-label="Log out" onClick={onLogout}><LogOut size={20} /></button></div></header>;
}
