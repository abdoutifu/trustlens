import { useEffect, useRef, useState } from 'react';
import { CircleCheck, FileText, X } from 'lucide-react';
import { sources, type AuditEntry, type Role, type Source, type Tab, type VerifiedCard } from './data/scenario';
import { permissions, recommendation, validateCardInput } from './lib/scoring';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ValidateModal, type ValidationInput } from './components/ValidateModal';
import { Decision } from './pages/Decision';
import { VerifiedCards } from './pages/VerifiedCards';
import { AuditTrail } from './pages/AuditTrail';
import { ComplianceRules } from './pages/ComplianceRules';
function SourcePreview({ source, close }: { source: Source; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; ref.current!.showModal(); return () => { ref.current?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="validate-modal source-preview" aria-labelledby="source-preview-title" onCancel={e => { e.preventDefault(); close(); }}><div className="modal-heading"><FileText /><button className="icon-button" aria-label="Close document" onClick={close}><X /></button></div><p className="eyebrow">Local source excerpt · {source.country}</p><h2 id="source-preview-title">{source.title}</h2><p>{source.claim}</p><p className="muted">Owner: {source.owner ?? 'No accountable owner'} · {source.date}</p><p className="muted">{source.reference.replace('View ', '')}</p><button className="button button-secondary" onClick={close}>Close excerpt</button></dialog>;
}
export default function App() {
  const [tab, setTab] = useState<Tab>('Decision'); const [role, setRole] = useState<Role>('Reviewer'); const [selected, setSelected] = useState(sources[0]);
  const [cards, setCards] = useState<VerifiedCard[]>([]); const [audit, setAudit] = useState<AuditEntry[]>([]); const [modal, setModal] = useState(false); const [preview, setPreview] = useState<Source | null>(null); const [toast, setToast] = useState(''); const [rejected, setRejected] = useState(false);
  const result = recommendation(sources);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  function navigate(target: Tab) { if (target === 'Audit Trail' && !permissions(role).canViewAudit) { setToast('Only Admins can view the audit trail.'); return; } setTab(target); }
  function changeRole(next: Role) { if (!['Reader', 'Reviewer', 'Admin'].includes(next)) return; setRole(next); setModal(false); if (tab === 'Audit Trail' && !permissions(next).canViewAudit) setTab('Decision'); }
  function appendAudit(what: string, reason: string) { setAudit(entries => [...entries, { id: crypto.randomUUID(), who: `Alex Morgan (${role})`, what, when: new Date().toISOString(), reason }]); }
  function openValidation() { if (!permissions(role).canValidate) { setToast('Reviewer or Admin role required.'); return; } if (rejected || result.state !== 'confident' || !result.top) return; setModal(true); }
  function validate(input: ValidationInput) {
    if (!permissions(role).canValidate) return 'Reviewer or Admin role required.';
    if (rejected || result.state !== 'confident' || !result.top) return 'This answer requires owner review.';
    const issue = validateCardInput(input); if (issue) return issue;
    const source = result.top;
    setCards(items => [...items, { ...input, id: crypto.randomUUID(), sourceId: source.id, title: source.title, createdAt: new Date().toISOString(), verifiedBy: `Alex Morgan (${role})` }]);
    appendAudit('Answer validated', `${source.title}: ${input.reason}`); setModal(false); setToast('Answer validated. Your verified card is ready in Verified cards.'); return null;
  }
  function escalate() { if (!permissions(role).canValidate) { setToast('Reviewer or Admin role required.'); return; } if (!result.top?.owner) return; appendAudit('Escalated to owner', `Requested review from ${result.top.owner} for ${result.top.title}.`); setToast(`Escalation recorded for ${result.top.owner}.`); }
  function reject() { if (rejected) return; setRejected(true); appendAudit('Answer rejected', 'Recommended answer flagged as not right; owner review required.'); setToast('Answer flagged for review. Escalate to the owner for clarification.'); }
  return <><TopNav tab={tab} role={role} onTab={navigate} onRole={changeRole} notify={setToast} /><div className="app-shell"><Sidebar tab={tab} onTab={navigate} role={role} entries={audit.length} /><main id="main" tabIndex={-1}>{tab === 'Decision' && <Decision selected={selected} select={setSelected} role={role} rejected={rejected} onReject={reject} onEscalate={escalate} onValidate={openValidation} inspect={setPreview} />}{tab === 'Verified cards' && <VerifiedCards cards={cards} onDecision={() => navigate('Decision')} />}{tab === 'Audit Trail' && <AuditTrail entries={audit} role={role} />}{tab === 'Compliance Rules' && <ComplianceRules />}</main></div>{modal && result.top && <ValidateModal source={result.top} onClose={() => setModal(false)} onSubmit={validate} />}{preview && <SourcePreview source={preview} close={() => setPreview(null)} />}<div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast && <div className="toast"><CircleCheck size={21} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={18} /></button></div>}</div></>;
}
