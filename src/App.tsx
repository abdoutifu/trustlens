import { useEffect, useRef, useState } from 'react';
import { CircleCheck, FileText, X, Plus, Search } from 'lucide-react';
import type { Session, Source, Tab, AuditEntry } from './data/scenario';
import * as api from './lib/api';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { ValidateModal } from './components/ValidateModal';
import { NewIssueModal } from './components/NewIssueModal';
import { Decision } from './pages/Decision';
import { VerifiedCards } from './pages/VerifiedCards';
import { AuditTrail } from './pages/AuditTrail';
import { ComplianceRules } from './pages/ComplianceRules';
function SourcePreview({ source, close }: { source: Source; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; const element = ref.current!; element.showModal(); return () => { element.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="validate-modal source-preview" aria-labelledby="source-preview-title" onCancel={e => { e.preventDefault(); close(); }}><div className="modal-heading"><FileText /><button className="icon-button" aria-label="Close document" onClick={close}><X /></button></div><p className="eyebrow">Exact source excerpt · {source.country}</p><h2 id="source-preview-title">{source.title}</h2><blockquote>{source.claim}</blockquote><p className="muted">Owner: {source.owner ?? 'No owner'} · {source.date}</p><p className="muted">{source.reference}</p><button className="button button-secondary" onClick={close}>Close excerpt</button></dialog>;
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null); const [initializing, setInitializing] = useState(true);
  const [data, setData] = useState<api.DecisionSnapshot | null>(null); const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('Decision'); const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState(false); const [newIssue, setNewIssue] = useState(false); const [preview, setPreview] = useState<Source | null>(null); const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false); const [audit, setAudit] = useState<AuditEntry[]>([]); const loadVersion = useRef(0); const viewGeneration = useRef(0); const actionPending = useRef(false);
  function current(generation: number) { return generation === viewGeneration.current; }
  function changeView() { ++viewGeneration.current; ++loadVersion.current; actionPending.current = false; setBusy(false); setModal(false); setPreview(null); }
  function beginAction() { if (actionPending.current || busy) return null; actionPending.current = true; setBusy(true); return viewGeneration.current; }
  function finishAction(generation: number) { if (current(generation)) { actionPending.current = false; setBusy(false); } }
  async function load(id = 'ticket-a') { const generation = viewGeneration.current; const version = ++loadVersion.current; setBusy(true); const result = await api.getScenario(id); if (version !== loadVersion.current || !current(generation)) return; setBusy(false); if (!result.ok) { setError(result.error.message); return; } setError(''); setData(result.data); setSelectedId(current => result.data.sources.some(s => s.id === current) ? current : result.data.evaluation.top?.id ?? result.data.sources[0]?.id ?? ''); }
  useEffect(() => { let active = true; void api.getSession().then(async s => { if (!active) return; setSession(s); setInitializing(false); if (s) await load(); }); return () => { active = false; }; }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { let active = true; setAudit([]); if (tab === 'Audit Trail' && data) void api.getAuditLog(data.question.id).then(result => { if (!active) return; if (result.ok) setAudit(result.data); else setToast(result.error.message); }); return () => { active = false; }; }, [tab, data]);
  async function signedIn() { changeView(); const generation = viewGeneration.current; const s = await api.getSession(); if (!current(generation)) return; setSession(s); setTab('Decision'); setToast(''); await load(); }
  async function logout() { changeView(); const generation = viewGeneration.current; await api.logout(); if (!current(generation)) return; setSession(null); setData(null); setModal(false); setPreview(null); setNewIssue(false); }
  if (initializing) return <main className="login-page"><p role="status">Connecting to the local service…</p></main>;
  if (!session) return <Login onLogin={() => void signedIn()} />;
  if (!data) return <main className="login-page"><p role={error ? 'alert' : 'status'}>{error || 'Loading your workspace…'}</p><button className="button" onClick={() => void load()}>Retry</button><button className="button" onClick={() => void logout()}>Log out</button></main>;
  const selected = data.sources.find(s => s.id === selectedId) ?? data.evaluation.top ?? data.sources[0];
  async function validate(input: api.ValidationInput) {
    const generation = beginAction();
    if (generation === null) return { code: 'CONFLICT' as const, message: 'Another action is in progress. Please wait.' };
    try { const result = await api.validateAnswer(input); if (!current(generation)) return null; if (!result.ok) return result.error; setModal(false); setSelectedId(result.data.id); setToast('Verified card created. The reviewed answer is now reusable authority.'); await load(input.questionId); return null; }
    finally { finishAction(generation); }
  }
  async function escalate() {
    if (!data) return; const generation = beginAction(); if (generation === null) return;
    try { const result = await api.escalate(data.question.id, data.evaluation.top?.id ?? '', 'Evidence requires an accountable owner review before this answer can be trusted.'); if (!current(generation)) return; if (!result.ok) setToast(result.error.message); else { setToast(`Escalation recorded for ${result.data.owner}.`); await load(data.question.id); } }
    finally { finishAction(generation); }
  }
  async function resolve(sourceId: string, reason: string) {
    if (!data?.escalation) return; const generation = beginAction(); if (generation === null) return;
    try { const result = await api.resolveEscalation(data.question.id, data.escalation.id, sourceId, reason); if (!current(generation)) return; if (!result.ok) setToast(result.error.message); else { setSelectedId(sourceId); setToast('Resolution recorded. Validate the cited clause to make it reusable.'); await load(data.question.id); } }
    finally { finishAction(generation); }
  }
  async function reset() {
    const generation = beginAction(); if (generation === null) return;
    try { const result = await api.resetDemo(); if (!current(generation)) return; if (!result.ok) setToast(result.error.message); else { changeView(); setToast('Demo restored to seeds.'); await load(); } }
    finally { finishAction(generation); }
  }
  async function find() {
    if (!data) return; const generation = beginAction(); if (generation === null) return;
    try { const result = await api.findKnowledge(data.question.id); if (!current(generation)) return; if (!result.ok) setToast(result.error.message); await load(data.question.id); }
    finally { finishAction(generation); }
  }
  async function create(input: { question: string; countryCode: string; customer: string; year: number }) {
    const generation = beginAction(); if (generation === null) return { code: 'CONFLICT' as const, message: 'Another action is in progress. Please wait.' };
    try { const result = await api.createIssue(input); if (!current(generation)) return null; if (!result.ok) return result.error; changeView(); setData(result.data); setSelectedId(''); setTab('Decision'); setNewIssue(false); setToast('Issue created. Find matching knowledge to begin the evidence review.'); return null; }
    finally { finishAction(generation); }
  }
  async function inspect(source: Source) { if (busy) return; const generation = viewGeneration.current; const result = await api.getSources(data!.question.id, source.id); if (!current(generation)) return; if (result.ok) setPreview(result.data[0]); else setToast(result.error.message); }
  return <><TopNav tab={tab} session={session} onTab={setTab} onLogout={() => void logout()} notify={setToast} status={data.evaluation.message} /><div className="app-shell"><Sidebar tab={tab} onTab={setTab} session={session} entries={data.auditCount} /><main id="main" tabIndex={-1} aria-busy={busy}>{error && <p role="alert">{error}</p>}{tab === 'Decision' && <><div className="issue-toolbar"><p>Create → Find → Understand → Trust → Review → Reuse</p><button className="button button-secondary" disabled={!session.capabilities.canValidate || busy} onClick={() => setNewIssue(true)}><Plus size={17} />New issue</button></div>{data.search && <section className="search-status" aria-live="polite"><div><strong>{busy ? 'Finding knowledge and comparing exact excerpts…' : data.search.message}</strong><p>Search uses available tenant knowledge. AI compares retrieved excerpts; scoring and review rules determine the answer.</p></div><button className="button button-primary" disabled={busy || !session.capabilities.canValidate} onClick={() => void find()}><Search size={17} />{busy ? 'Searching…' : data.search.status === 'pending' ? 'Find knowledge' : 'Search again'}</button></section>}<Decision key={data.question.id} data={data} selected={selected} select={source => setSelectedId(source.id)} session={session} onTicket={id => { changeView(); void load(id); }} onReset={() => void reset()} onEscalate={() => void escalate()} onResolve={(id, reason) => void resolve(id, reason)} onValidate={() => setModal(true)} inspect={source => void inspect(source)} />{data.search?.citations.length ? <section className="citation-list"><h2>Evidence used</h2>{data.search.citations.map(c => <div key={c.sourceId}><button className="text-link" onClick={() => { const source = data.sources.find(s => s.id === c.sourceId); if (source) void inspect(source); }}>{c.reference}</button><blockquote>{c.quote}</blockquote></div>)}</section> : null}</>}{tab === 'Verified cards' && <VerifiedCards cards={data.cards} onDecision={() => setTab('Decision')} />}{tab === 'Audit Trail' && <AuditTrail entries={audit} />}{tab === 'Compliance Rules' && <ComplianceRules />}</main></div>{modal && data.evaluation.top && <ValidateModal source={data.evaluation.top} onClose={() => setModal(false)} onSubmit={validate} />}{newIssue && <NewIssueModal onClose={() => setNewIssue(false)} onSubmit={create} />}{preview && <SourcePreview source={preview} close={() => setPreview(null)} />}<div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast && <div className="toast"><CircleCheck size={20} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={18} /></button></div>}</div></>;
}
