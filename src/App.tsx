import { useEffect, useRef, useState } from 'react';
import { CircleCheck, FileText, X, Plus, Search, TriangleAlert, LoaderCircle } from 'lucide-react';
import type { Session, Source, Tab, AuditEntry, VerifiedCard } from './data/scenario';
import * as api from './lib/api';
import { cardStatus } from './lib/scoring';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { ValidateModal } from './components/ValidateModal';
import { NewIssueModal } from './components/NewIssueModal';
import { Decision } from './pages/Decision';
import { VerifiedCards } from './pages/VerifiedCards';
import { AuditTrail } from './pages/AuditTrail';
import { ComplianceRules } from './pages/ComplianceRules';
type Progress = 'searching' | 'comparing' | 'building' | null;
const progressLabels = { searching: 'Searching trusted knowledge…', comparing: 'Comparing sources…', building: 'Building recommendation…' };
function SourcePreview({ source, close }: { source: Source; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; const element = ref.current!; element.showModal(); return () => { element.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="validate-modal source-preview" aria-labelledby="source-preview-title" onCancel={e => { e.preventDefault(); close(); }}><div className="modal-heading"><FileText /><button className="icon-button" aria-label="Close document" onClick={close}><X /></button></div><p className="eyebrow">Exact source excerpt · {source.country}</p><h2 id="source-preview-title">{source.title}</h2><blockquote>{source.claim}</blockquote><p className="muted">Owner: {source.owner ?? 'No owner'} · {source.date}</p><p className="muted">{source.reference}</p><button className="button button-secondary" onClick={close}>Close excerpt</button></dialog>;
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [data, setData] = useState<api.DecisionSnapshot | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('Decision');
  const [queue, setQueue] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState(false);
  const [newIssue, setNewIssue] = useState(false);
  const [preview, setPreview] = useState<Source | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [highlightId, setHighlightId] = useState('');
  const [completion, setCompletion] = useState<'validated' | 'escalated' | 'resolved' | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const loadVersion = useRef(0);
  const viewGeneration = useRef(0);
  const actionPending = useRef(false);
  const previewVersion = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  function notify(message: string, isError = false) { setNotice({ message, error: isError }); }
  function navigateTab(next: Tab) { setTab(next); window.scrollTo({ top: 0 }); }
  function current(generation: number) { return generation === viewGeneration.current; }
  function changeView() {
    ++viewGeneration.current; ++loadVersion.current; ++previewVersion.current; actionPending.current = false;
    setBusy(false); setProgress(null); setModal(false); setPreview(null); setError(''); setCompletion(null); setHighlightId('');
  }
  function beginAction() { if (actionPending.current || busy) return null; actionPending.current = true; setBusy(true); return viewGeneration.current; }
  function finishAction(generation: number) { if (current(generation)) { actionPending.current = false; setBusy(false); } }
  function revealResult(snapshot: api.DecisionSnapshot, generation: number, preferredId?: string) {
    setSelectedId(preferredId ?? snapshot.evaluation.top?.id ?? snapshot.sources[0]?.id ?? '');
    setHighlightId(!preferredId || preferredId === snapshot.evaluation.top?.id ? snapshot.evaluation.top?.id ?? '' : '');
    clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => { if (current(generation)) setHighlightId(''); }, 2500);
    requestAnimationFrame(() => {
      if (!current(generation)) return;
      const target = resultRef.current;
      target?.focus({ preventScroll: true });
      if (target && (target.getBoundingClientRect().bottom > window.innerHeight || target.getBoundingClientRect().top < 72)) target.scrollIntoView({ block: 'start', behavior: 'auto' });
      requestAnimationFrame(() => { if (current(generation)) setProgress(null); });
    });
  }
  async function load(id = 'ticket-a'): Promise<api.DecisionSnapshot | null> {
    const generation = viewGeneration.current; const version = ++loadVersion.current;
    setBusy(true);
    const result = await api.getScenario(id);
    if (version !== loadVersion.current || !current(generation)) return null;
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return null; }
    setError(''); setData(result.data);
    setSelectedId(value => result.data.sources.some(s => s.id === value) ? value : result.data.evaluation.top?.id ?? result.data.sources[0]?.id ?? '');
    return result.data;
  }
  useEffect(() => { let active = true; void api.getSession().then(async s => { if (!active) return; setSession(s); setInitializing(false); if (s) await load(); }); return () => { active = false; clearTimeout(highlightTimer.current); }; }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 7500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { let active = true; setAudit([]); if (tab === 'Audit Trail' && data) void api.getAuditLog(data.question.id).then(result => { if (!active) return; if (result.ok) setAudit(result.data); else notify(result.error.message, true); }); return () => { active = false; }; }, [tab, data]);
  async function signedIn() { changeView(); const generation = viewGeneration.current; const s = await api.getSession(); if (!current(generation)) return; setSession(s); setTab('Decision'); setQueue(true); setNotice(null); await load(); }
  async function logout() { changeView(); const generation = viewGeneration.current; await api.logout(); if (!current(generation)) return; setSession(null); setData(null); setNewIssue(false); }
  async function searchIssue(questionId: string, generation: number) {
    setProgress('searching'); setBusy(true); actionPending.current = true; setCompletion(null);
    let polling = false; let finished = false;
    const timer = window.setInterval(async () => {
      if (finished || polling || !current(generation)) return;
      polling = true;
      try { const state = await api.getScenario(questionId); if (!finished && current(generation) && state.ok && state.data.search?.phase === 'comparing') setProgress('comparing'); }
      finally { polling = false; }
    }, 350);
    try {
      const result = await api.findKnowledge(questionId);
      finished = true; clearInterval(timer);
      if (!current(generation)) return;
      if (!result.ok) { setProgress(null); setError(result.error.message); notify(result.error.message, true); return; }
      setProgress('building'); setData(result.data); setError('');
      if (result.data.search?.status === 'error') notify('Comparison unavailable. Retry or send this issue for owner review.', true);
      else if (result.data.search?.status === 'empty') notify('No sufficient evidence. Send this issue for owner review.');
      else notify(result.data.evaluation.conflictCount ? 'Sources compared. An owner must resolve the disagreement.' : 'Evidence ready. Inspect the cited clause, then validate.');
      revealResult(result.data, generation);
    } finally { finished = true; clearInterval(timer); finishAction(generation); }
  }
  async function find() { if (!data) return; const generation = beginAction(); if (generation !== null) await searchIssue(data.question.id, generation); }
  async function create(input: api.CreateIssueInput) {
    const generation = beginAction(); if (generation === null) return { code: 'CONFLICT' as const, message: 'Another action is in progress. Please wait.' };
    try {
      const result = await api.createIssue(input);
      if (!current(generation)) return null;
      if (!result.ok) return result.error;
      changeView(); setData(result.data); setSelectedId(''); setTab('Decision'); setQueue(false); setNewIssue(false);
      await searchIssue(result.data.question.id, viewGeneration.current);
      return null;
    } finally { finishAction(generation); }
  }
  async function validate(input: api.ValidationInput) {
    const generation = beginAction(); if (generation === null) return { code: 'CONFLICT' as const, message: 'Another action is in progress. Please wait.' };
    try {
      const result = await api.validateAnswer(input); if (!current(generation)) return null; if (!result.ok) return result.error;
      setModal(false); setCompletion('validated'); notify('Answer validated and added to reusable knowledge. Next: view the verified card.');
      const snapshot = await load(input.questionId); if (snapshot) revealResult(snapshot, generation);
      return null;
    } finally { finishAction(generation); }
  }
  async function escalate() {
    if (!data) return; const generation = beginAction(); if (generation === null) return;
    try {
      const result = await api.escalate(data.question.id, data.evaluation.top?.id ?? '', 'Evidence requires an accountable owner review before this answer can be trusted.');
      if (!current(generation)) return;
      if (!result.ok) notify(result.error.message, true);
      else { setCompletion('escalated'); notify(`Review recorded for ${result.data.owner}. ${data.evaluation.validSources.length ? 'Next: record the applicable clause and the owner’s reason.' : 'Next: find sufficient evidence before recording a resolution.'}`); await load(data.question.id); requestAnimationFrame(() => { if (current(generation)) document.querySelector<HTMLElement>('.escalation-panel')?.scrollIntoView({ block: 'nearest' }); }); }
    } finally { finishAction(generation); }
  }
  async function resolve(sourceId: string, reason: string) {
    if (!data?.escalation) return; const generation = beginAction(); if (generation === null) return;
    try {
      const result = await api.resolveEscalation(data.question.id, data.escalation.id, sourceId, reason); if (!current(generation)) return;
      if (!result.ok) notify(result.error.message, true);
      else { setCompletion('resolved'); notify('Owner resolution recorded. Next: validate the selected clause with a review date.'); const snapshot = await load(data.question.id); if (snapshot) revealResult(snapshot, generation); }
    } finally { finishAction(generation); }
  }
  async function reset() {
    const generation = beginAction(); if (generation === null) return;
    try { const result = await api.resetDemo(); if (!current(generation)) return; if (!result.ok) notify(result.error.message, true); else { changeView(); setTab('Decision'); setQueue(true); setNewIssue(false); notify('Demo reset. The two sample tickets and expired card are ready.'); await load(); window.scrollTo({ top: 0 }); } }
    finally { finishAction(generation); }
  }
  async function inspect(source: Source) { if (busy || !data) return; const generation = viewGeneration.current; const version = ++previewVersion.current; const result = await api.getSources(data.question.id, source.id); if (!current(generation) || version !== previewVersion.current) return; if (result.ok) setPreview(result.data[0]); else notify(result.error.message, true); }
  async function switchTicket(id: string) { changeView(); setQueue(false); const generation = viewGeneration.current; const snapshot = await load(id); if (snapshot) revealResult(snapshot, generation); }
  async function reuse(card: VerifiedCard) { changeView(); setQueue(false); const generation = viewGeneration.current; setTab('Decision'); const snapshot = await load(card.questionId); if (snapshot && current(generation)) { revealResult(snapshot, generation, card.id); notify(cardStatus(card.reviewBy) === 'expired' ? 'Expired answer opened for comparison. Use current eligible evidence to re-verify.' : 'Verified answer reopened with its source citation and review date.'); } }
  if (initializing) return <main className="login-page"><p role="status">Connecting to the local service…</p></main>;
  if (!session) return <Login onLogin={() => void signedIn()} />;
  if (!data) return <main className="login-page"><p role={error ? 'alert' : 'status'}>{error || 'Loading your workspace…'}</p><button className="button button-primary" onClick={() => void load()}>Retry</button><button className="button button-secondary" onClick={() => void logout()}>Log out</button></main>;
  const selected = data.sources.find(s => s.id === selectedId) ?? data.evaluation.top ?? data.sources[0];
  const searchFailed = data.search?.status === 'error';
  return <>
    <TopNav tab={tab} session={session} onTab={navigateTab} onLogout={() => void logout()} notify={notify} status={data.evaluation.message} />
    <div className="app-shell"><Sidebar tab={tab} onTab={next => { if (next === 'Decision') { changeView(); setQueue(true); } navigateTab(next); }} session={session} entries={data.auditCount} /><main id="main" tabIndex={-1} aria-busy={busy}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {tab === 'Decision' && <>
        <div className="issue-toolbar"><p>Create → Find → Understand → Trust → Review → Reuse</p>{session.capabilities.canValidate && <button className={`button ${queue ? 'button-primary' : 'button-secondary button-new-issue'}`} disabled={busy} onClick={() => setNewIssue(true)}><Plus size={17} />New issue</button>}</div>
        {queue ? <section className="page-section queue-page"><p className="eyebrow">Your workspace</p><h1>Active Queue</h1>{data.tickets.filter(ticket => !['ticket-a', 'ticket-b'].includes(ticket.id)).length === 0 ? <div className="empty-state panel"><FileText size={34} /><h2>No active issues yet.</h2><p>Create an issue to find evidence, compare clauses and review an answer.</p></div> : <div className="queue-list">{data.tickets.filter(ticket => !['ticket-a', 'ticket-b'].includes(ticket.id)).map(ticket => <button key={ticket.id} className="queue-ticket panel" onClick={() => void switchTicket(ticket.id)}><span>{ticket.ticket}</span><strong>{ticket.question}</strong><span>{ticket.context.country} · {ticket.context.customer} · {ticket.context.year}</span></button>)}</div>}<div className="queue-tools"><details><summary>Sample decisions</summary>{data.tickets.filter(ticket => ['ticket-a', 'ticket-b'].includes(ticket.id)).map(ticket => <button className="text-link" key={ticket.id} onClick={() => void switchTicket(ticket.id)}>{ticket.title}</button>)}</details>{session.capabilities.canReset && <button className="text-link" disabled={busy} onClick={() => void reset()}>Reset demo</button>}</div></section> : <>
        {(progress || data.search) && <section className={`search-status ${searchFailed ? 'search-error' : ''}`} aria-live="polite" aria-atomic="true"><div><strong>{progress ? <><LoaderCircle size={17} className="progress-spinner" />{progressLabels[progress]}</> : data.search?.status === 'ready' ? 'Sources compared · exact evidence ready for review' : data.search?.status === 'empty' ? 'No sufficient evidence · owner review needed' : data.search?.status === 'error' ? 'Comparison unavailable · no answer approved' : 'Evidence has not been checked yet'}</strong>{searchFailed && !progress && <p>{data.search?.message}</p>}</div>{!progress && !busy && session.capabilities.canValidate && data.search?.status !== 'ready' && <button className="button button-secondary" onClick={() => void find()}><Search size={17} />{searchFailed ? 'Retry comparison' : 'Find knowledge'}</button>}</section>}
        {completion && <section className="action-confirmation" role="status"><CircleCheck size={18} /><p>{completion === 'validated' ? 'Answer validated. The verified card is ready to reuse.' : completion === 'resolved' ? 'Resolution recorded. Validate the selected clause to complete this review.' : data.evaluation.validSources.length ? 'Escalation recorded. Record the owner’s resolution below.' : 'Escalation recorded. Find sufficient evidence before recording a resolution.'}</p>{completion === 'validated' && <button className="button button-primary" onClick={() => navigateTab('Verified cards')}>View verified card</button>}</section>}
        <div ref={resultRef} className="decision-result" tabIndex={-1} aria-label="Knowledge review result">
          <Decision key={data.question.id} data={data} selected={selected} select={source => { setSelectedId(source.id); setHighlightId(''); }} session={session} onTicket={id => void switchTicket(id)} onReset={() => void reset()} onEscalate={() => void escalate()} onResolve={(id, reason) => void resolve(id, reason)} onValidate={() => setModal(true)} inspect={source => void inspect(source)} busy={busy || !!progress} highlightedId={highlightId} validated={completion === 'validated'} />
        </div>
        {!!data.search?.citations.length && <details className="citation-list"><summary>Exact comparison evidence · {data.search.citations.length} citations</summary>{data.search.citations.map(c => <div key={c.sourceId}><button className="text-link" onClick={() => { const source = data.sources.find(s => s.id === c.sourceId); if (source) void inspect(source); }}>{c.reference}</button><blockquote>{c.quote}</blockquote></div>)}</details>}
        </>}
      </>}
      {tab === 'Verified cards' && <VerifiedCards cards={data.cards} onDecision={() => navigateTab('Decision')} onReuse={card => void reuse(card)} />}
      {tab === 'Audit Trail' && <AuditTrail entries={audit} />}
      {tab === 'Compliance Rules' && <ComplianceRules />}
    </main></div>
    {modal && data.evaluation.top && <ValidateModal source={data.evaluation.top} onClose={() => setModal(false)} onSubmit={validate} />}
    {newIssue && <NewIssueModal onClose={() => setNewIssue(false)} onSubmit={create} />}
    {preview && <SourcePreview source={preview} close={() => { ++previewVersion.current; setPreview(null); }} />}
    <div className="toast-region" role={notice?.error ? 'alert' : 'status'} aria-live={notice?.error ? 'assertive' : 'polite'} aria-atomic="true">{notice && <div className={`toast ${notice.error ? 'toast-error' : ''}`}>{notice.error ? <TriangleAlert size={20} /> : <CircleCheck size={20} />}<span>{notice.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={18} /></button></div>}</div>
  </>;
}
