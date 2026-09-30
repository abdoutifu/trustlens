import { AsyncLocalStorage } from 'node:async_hooks';
import { compareSources } from './compare';
import { seededQuestions, seededSources, seedVerifiedCards, type AuditEntry, type Capabilities, type Escalation, type Role, type Scenario, type ScopedEntity, type Session, type Source, type VerifiedCard } from '../src/data/scenario';
import { cardAsSource, evaluate, rejectionReasons, reviewDateBounds, validDate, type Evaluation } from '../src/lib/scoring';

export interface ApiError { code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT' | 'SERVICE_ERROR'; message: string; field?: string }
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export interface ValidationInput { questionId: string; sourceId: string; claim: string; reason: string; owner: string; reviewBy: string }
export interface DecisionSnapshot { tickets: Scenario[]; question: Scenario; sources: Source[]; cards: VerifiedCard[]; escalation?: Escalation; evaluation: Evaluation; auditCount: number; search?: SearchState }

export interface CreateIssueInput { question: string; countryCode: string; customer: string; year: number }
export interface SearchState { status: 'pending' | 'ready' | 'empty' | 'error'; phase?: 'searching' | 'comparing'; message: string; citations: {sourceId: string; reference: string; quote: string}[]; relationship?: 'agreement' | 'conflict' | 'insufficient'; answersQuestion?: boolean }
const searches = new Map<string, SearchState>();
export const requestContext = new AsyncLocalStorage<{session: Session | null}>();
// Deliberately non-cryptographic mock hash for the local demo, never production auth.
export function demoHash(text: string) { let value = 2166136261; for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619); return (value >>> 0).toString(16).padStart(8, '0'); }
export function canonicalPayload(value: Record<string, unknown>) { return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))); }
function freeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function snapshot<T>(value: T): T { return freeze(structuredClone(value)); }
function capabilities(role: Role): Capabilities { const review = role === 'Reviewer' || role === 'Admin'; return { canValidate: review, canEscalate: review, canResolve: review, canViewAudit: role === 'Admin', canReset: review }; }
const users = freeze([
  { email: 'reader@trustlens.demo', passwordHash: 'ab4f07e8', userId: 'reader-acme', name: 'Robin Reader', role: 'Reader' as Role, tenantId: 'acme' },
  { email: 'reviewer@trustlens.demo', passwordHash: 'aaa378d4', userId: 'reviewer-acme', name: 'Alex Reviewer', role: 'Reviewer' as Role, tenantId: 'acme' },
  { email: 'admin@trustlens.demo', passwordHash: 'a332fa7e', userId: 'admin-acme', name: 'Sam Admin', role: 'Admin' as Role, tenantId: 'acme' },
]);
const foreignCard: VerifiedCard = { ...seedVerifiedCards[0], id: 'other-card', tenantId: 'other-company', questionId: 'other-ticket', sourceId: 'other-source' };
const foreignEscalation: Escalation = { id: 'other-escalation', tenantId: 'other-company', questionId: 'other-ticket', sourceId: 'other-source', owner: 'Other owner', reason: 'Other company review.', status: 'open', createdAt: '2026-01-01T00:00:00Z' };
const store = { session: null as Session | null, questions: [...snapshot(seededQuestions)], sources: [...snapshot(seededSources)], cards: snapshot([...seedVerifiedCards, foreignCard]), escalations: snapshot([foreignEscalation]), audit: [] as AuditEntry[] };
class Failure extends Error { constructor(public detail: ApiError) { super(detail.message); } }
function fail(code: ApiError['code'], message: string, field?: string): never { throw new Failure({ code, message, ...(field ? { field } : {}) }); }
function run<T>(action: () => T): Result<T> { try { return { ok: true, data: snapshot(action()) }; } catch (error) { if (error instanceof Failure) return { ok: false, error: error.detail }; throw error; } }
function activeSession() { return requestContext.getStore()?.session ?? (requestContext.getStore() ? null : store.session); }
function setSession(session: Session | null) { const context = requestContext.getStore(); if (context) context.session = session; else store.session = session; }
function requireSession(): Session { if (!activeSession()) fail('UNAUTHENTICATED', 'Sign in to access this demo.'); return activeSession()!; }
function requirePermission(key: keyof Capabilities) { const session = requireSession(); if (!session.capabilities[key]) fail('FORBIDDEN', 'Your account cannot perform this action.'); return session; }
function scoped<T extends ScopedEntity>(items: T[], id: string, questionId?: string): T {
  const session = requireSession();
  const item = items.find(entity => entity.id === id && entity.tenantId === session.tenantId && (!questionId || entity.questionId === questionId));
  if (!item) fail('NOT_FOUND', 'This item is not available in your tenant and question.');
  return item;
}
function question(id: string) { return scoped(store.questions, id, id); }
function currentSources(q: Scenario) { return [...store.sources.filter(s => s.tenantId === q.tenantId && s.questionId === q.id), ...store.cards.filter(c => c.tenantId === q.tenantId && c.questionId === q.id).map(cardAsSource)]; }
function latestEscalation(q: Scenario) { return store.escalations.filter(e => e.tenantId === q.tenantId && e.questionId === q.id).at(-1); }
function evaluation(q: Scenario): Evaluation {
  const search = searches.get(q.id);
  if (search && search.status !== 'ready') {
    const blocked = evaluate(q, currentSources(q));
    return { ...blocked, state: 'none', top: undefined, validSources: [], excludedSources: currentSources(q).map(source => ({ source, reasons: [...rejectionReasons(source, q), 'Evidence comparison is not sufficient for this question.'] })), conflictCount: 0, gap: null, flags: [], canValidate: false, canEscalate: true, canResolve: false, message: search.message, confidenceLabel: search.status === 'pending' ? 'Awaiting evidence' : search.status === 'error' ? 'Comparison unavailable' : 'No sufficient evidence' };
  }
  const escalation = latestEscalation(q);
  const result = evaluate(q, currentSources(q), escalation?.status === 'resolved' && !escalation.validatedCardId ? escalation.selectedSourceId : undefined);
  const reviewedHere = !!escalation?.validatedCardId && result.top?.id === escalation.validatedCardId;
  if (search?.relationship === 'conflict' && !result.resolvedSourceId && !reviewedHere) return { ...result, state: 'escalation', conflictCount: Math.max(1, result.conflictCount), confidenceLabel: 'Owner review required', message: 'Two valid sources disagree. Ask the owner.', canValidate: false, canResolve: true, flags: [...result.flags, 'Cited comparison detected disagreement'] };
  return result;
}
function reasonText(value: unknown): string { if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 500) fail('INVALID_INPUT', 'Reason must contain 3–500 characters after trimming.', 'reason'); return value.trim(); }
function append(q: Scenario, action: string, target: string, reason: string) {
  const session = requireSession();
  const previousHash = store.audit.filter(e => e.tenantId === session.tenantId && e.questionId === q.id).at(-1)?.hash ?? '00000000';
  const payload = { id: crypto.randomUUID(), tenantId: session.tenantId, questionId: q.id, actor: session.name, role: session.role, action, target, reason, timestamp: new Date().toISOString(), previousHash };
  store.audit.push(freeze({ ...payload, hash: demoHash(canonicalPayload(payload)) }));
}
export function login(email: string, password: string): Result<Session> { return run(() => {
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200) fail('INVALID_INPUT', 'Use a listed demo account and password.');
  const user = users.find(u => u.email === email.trim().toLowerCase() && u.passwordHash === demoHash(password));
  if (!user) fail('UNAUTHENTICATED', 'Incorrect demo email or password.');
  setSession(freeze({ userId: user.userId, name: user.name, role: user.role, tenantId: user.tenantId, capabilities: capabilities(user.role) }));
  return activeSession()!;
}); }
export function logout() { setSession(null); }
export function getSession(): Session | null { return activeSession() ? snapshot(activeSession()!) : null; }
export function getScenario(questionId = 'ticket-a'): Result<DecisionSnapshot> { return run(() => {
  const session = requireSession(); const q = question(questionId);
  return { tickets: store.questions.filter(t => t.tenantId === session.tenantId), question: q, sources: currentSources(q), cards: store.cards.filter(c => c.tenantId === session.tenantId && c.questionId === q.id), escalation: latestEscalation(q), search: searches.get(q.id), evaluation: evaluation(q), auditCount: session.capabilities.canViewAudit ? store.audit.filter(e => e.tenantId === session.tenantId && e.questionId === q.id).length : 0 };
}); }
export function getSources(questionId: string, sourceId?: string): Result<Source[]> { return run(() => { const q = question(questionId); const items = currentSources(q); return sourceId !== undefined ? [scoped(items, sourceId, q.id)] : items; }); }
export function getVerifiedCards(questionId: string, cardId?: string): Result<VerifiedCard[]> { return run(() => { const q = question(questionId); return cardId !== undefined ? [scoped(store.cards, cardId, q.id)] : store.cards.filter(c => c.tenantId === q.tenantId && c.questionId === q.id); }); }
export function getAuditLog(questionId: string): Result<AuditEntry[]> { return run(() => { requirePermission('canViewAudit'); const q = question(questionId); return store.audit.filter(e => e.tenantId === q.tenantId && e.questionId === q.id); }); }
export function validateAnswer(input: ValidationInput): Result<VerifiedCard> { return run(() => {
  const session = requirePermission('canValidate');
  if (!input || typeof input !== 'object') fail('INVALID_INPUT', 'Validation fields are required.');
  const q = question(input.questionId); const source = scoped(currentSources(q), input.sourceId, q.id);
  const reason = reasonText(input.reason);
  if (typeof input.claim !== 'string' || !input.claim.trim() || input.claim.length > 2000) fail('INVALID_INPUT', 'Claim is required and must be at most 2,000 characters.', 'claim');
  if (input.claim.trim() !== source.claim.trim()) fail('INVALID_INPUT', 'Claim must match the selected source clause.', 'claim');
  if (typeof input.owner !== 'string' || input.owner.trim() !== source.owner || input.owner.length > 120) fail('INVALID_INPUT', 'Use the selected source’s accountable owner.', 'owner');
  const bounds = reviewDateBounds();
  if (typeof input.reviewBy !== 'string' || !validDate(input.reviewBy) || input.reviewBy < bounds.min || input.reviewBy > bounds.max) fail('INVALID_INPUT', 'Review-by must be strictly future and no more than 24 months away.', 'reviewBy');
  const result = evaluation(q);
  if (!result.canValidate || result.top?.id !== source.id || rejectionReasons(source, q).length) fail('CONFLICT', 'Resolve the current disagreement before validating the recommended clause.');
  const card: VerifiedCard = freeze({ id: crypto.randomUUID(), tenantId: session.tenantId, questionId: q.id, sourceId: source.id, citation: { sourceId: source.id, reference: source.reference, quote: source.claim }, title: `${source.title} · verified answer`, claim: source.claim, stance: source.stance, country: source.country, reason, owner: source.owner!, reviewBy: input.reviewBy, createdAt: new Date().toISOString(), verifiedBy: session.name });
  store.cards = [...store.cards, card];
  const escalation = latestEscalation(q);
  if (escalation?.status === 'resolved') store.escalations = store.escalations.map(e => e.id === escalation.id && e.tenantId === session.tenantId && e.questionId === q.id ? freeze({ ...e, validatedCardId: card.id }) : e);
  append(q, 'Answer validated', card.id, reason + '\nEvidence: ' + canonicalPayload(card.citation!)); return card;
}); }
export function escalate(questionId: string, sourceId: string, reason: string): Result<Escalation> { return run(() => {
  const session = requirePermission('canEscalate'); const q = question(questionId); const cleanReason = reasonText(reason);
  const noEvidence = sourceId === '' && searches.has(q.id) && searches.get(q.id)?.status !== 'ready';
  const source = noEvidence ? undefined : scoped(currentSources(q), sourceId, q.id);
  if (!noEvidence && (!source || rejectionReasons(source, q).length || !evaluation(q).canEscalate)) fail('CONFLICT', 'Choose a current eligible source to escalate.');
  if (latestEscalation(q)?.status === 'open') fail('CONFLICT', 'This ticket already has an open escalation.');
  const entry: Escalation = freeze({ id: crypto.randomUUID(), tenantId: session.tenantId, questionId: q.id, sourceId, owner: source?.owner ?? 'Workspace reviewer queue', reason: cleanReason, status: 'open', createdAt: new Date().toISOString() });
  store.escalations = [...store.escalations, entry]; append(q, 'Escalated to owner', entry.id, cleanReason); return entry;
}); }
export function resolveEscalation(questionId: string, escalationId: string, sourceId: string, reason: string): Result<Escalation> { return run(() => {
  const session = requirePermission('canResolve'); const q = question(questionId); const entry = scoped(store.escalations, escalationId, q.id); const source = scoped(currentSources(q), sourceId, q.id); const cleanReason = reasonText(reason);
  if (searches.has(q.id) && searches.get(q.id)?.status !== 'ready') fail('CONFLICT', 'Evidence must be successfully compared before an escalation can be resolved.');
  if (!evaluation(q).canEscalate || entry.status !== 'open' || entry.id !== latestEscalation(q)?.id || rejectionReasons(source, q).length) fail('CONFLICT', 'Resolve an open escalation with successfully compared current eligible evidence.');
  const resolved = freeze({ ...entry, status: 'resolved' as const, selectedSourceId: source.id, resolutionReason: cleanReason, resolvedAt: new Date().toISOString() });
  store.escalations = store.escalations.map(e => e.id === entry.id && e.tenantId === session.tenantId && e.questionId === q.id ? resolved : e);
  append(q, 'Escalation resolved', entry.id, cleanReason); return resolved;
}); }
export function resetDemo(): Result<null> { return run(() => {
  const session = requirePermission('canReset'); const tenant = session.tenantId;
  store.cards = [...store.cards.filter(e => e.tenantId !== tenant), ...snapshot(seedVerifiedCards.filter(e => e.tenantId === tenant))];
  store.escalations = store.escalations.filter(e => e.tenantId !== tenant);
  store.audit = store.audit.filter(e => e.tenantId !== tenant);
  store.questions = [...store.questions.filter(q => q.tenantId !== tenant), ...snapshot(seededQuestions.filter(q => q.tenantId === tenant))];
  store.sources = [...store.sources.filter(q => q.tenantId !== tenant), ...snapshot(seededSources.filter(q => q.tenantId === tenant))];
  searches.forEach((_v, id) => { if (!store.questions.some(q => q.id === id)) searches.delete(id); });
  return null;
}); }

export function createIssue(input: CreateIssueInput): Result<DecisionSnapshot> { return run(() => {
  const session = requirePermission('canValidate');
  if (!input || typeof input !== 'object' || typeof input.question !== 'string' || input.question.trim().length < 10 || input.question.trim().length > 1000) fail('INVALID_INPUT', 'Question must contain 10–1,000 characters.', 'question');
  if (!['BE', 'FR'].includes(input.countryCode)) fail('INVALID_INPUT', 'Choose Belgium or France.', 'countryCode');
  if (typeof input.customer !== 'string' || input.customer.trim().length < 2 || input.customer.trim().length > 100) fail('INVALID_INPUT', 'Customer must contain 2–100 characters.', 'customer');
  if (!Number.isInteger(input.year) || input.year < 2020 || input.year > 2030) fail('INVALID_INPUT', 'Choose a payroll year from 2020–2030.', 'year');
  if (store.questions.filter(q => q.tenantId === session.tenantId).length >= 50) fail('CONFLICT', 'Reset the demo before creating more tickets.');
  const id = crypto.randomUUID();
  const q: Scenario = freeze({ id, questionId: id, tenantId: session.tenantId, ticket: `TL-${id.slice(0, 8)}`, title: input.question.trim().slice(0, 70), question: input.question.trim(), context: { countryCode: input.countryCode, country: input.countryCode === 'BE' ? 'Belgium' : 'France', customer: input.customer.trim(), year: input.year } });
  store.questions = [...store.questions, q];
  searches.set(id, { status: 'pending', message: 'Find knowledge to retrieve and compare evidence for this question.', citations: [] });
  append(q, 'Issue created', id, 'New question submitted for evidence retrieval.');
  const response = getScenario(id); if (!response.ok) throw new Failure(response.error); return response.data;
}); }

const stopWords = new Set('a an and are as at be belgium belgian can customer does employee employees for from have how i in is it need of on our the their this to we what when with without year acme nv policy'.split(' '));
function tokens(value: string) { return value.toLowerCase().replace(/salary/g, 'payroll').replace(/\bcorrections?\b/g, 'correct').replace(/\bapprovals?\b/g, 'approve').match(/[a-z]{3,}/g)?.filter(t => !stopWords.has(t)) ?? []; }
function retrievalCandidates(q: Scenario): Source[] {
  const terms = new Set(tokens(q.question));
  const matches = (source: Source) => {
    const originalQuestion = store.questions.find(item => item.id === source.questionId && item.tenantId === q.tenantId);
    if (!originalQuestion || source.tenantId !== q.tenantId || originalQuestion.context.countryCode !== q.context.countryCode || originalQuestion.context.customer.toLowerCase() !== q.context.customer.toLowerCase() || originalQuestion.context.year !== q.context.year) return false;
    return tokens(`${source.title} ${source.claim}`).filter(t => terms.has(t)).length >= 2;
  };
  const documents = store.sources.filter(source => seededSources.some(seed => seed.id === source.id) && matches(source));
  const cards = store.cards.map(cardAsSource).filter(matches);
  return [...documents, ...cards].slice(0, 12);
}
export async function findKnowledge(questionId: string): Promise<Result<DecisionSnapshot>> {
  try {
    requirePermission('canValidate'); const q = question(questionId);
    if (!searches.has(q.id)) fail('CONFLICT', 'Seeded tickets already contain their reviewed source excerpts.');
    const previous = searches.get(q.id)!;
    if (previous.message === 'Retrieving and comparing source evidence…') fail('CONFLICT', 'A search is already running for this issue.');
    const pending: SearchState = { status: 'pending', phase: 'searching', message: 'Retrieving and comparing source evidence…', citations: [] };
    searches.set(q.id, pending);
    const candidates = retrievalCandidates(q);
    const idMap = new Map(candidates.map(source => [source.id, crypto.randomUUID()]));
    const retrieved = candidates.map(source => freeze({ ...source, id: idMap.get(source.id)!, questionId: q.id, reference: `${source.reference} · original source ${source.id}`, evidence: source.evidence.map(e => ({ ...e, id: idMap.get(e.id) ?? e.id, questionId: q.id })) }));
    const eligible = retrieved.filter(source => rejectionReasons(source, q).length === 0);
    let state: SearchState;
    if (!eligible.length) state = { status: 'empty', message: 'No eligible evidence matches this question and customer context. No answer recommended.', citations: [] };
    else {
      try {
        pending.phase = 'comparing';
        const comparison = await compareSources(q, eligible);
        state = { status: comparison.answersQuestion && comparison.relationship !== 'insufficient' ? 'ready' : 'empty', message: comparison.answersQuestion && comparison.relationship !== 'insufficient' ? 'Evidence retrieved; cited comparison complete.' : 'Retrieved clauses do not sufficiently answer this question. Ask the workspace reviewer queue.', ...comparison };
      }
      catch { state = { status: 'error', message: process.env.OPENAI_API_KEY ? 'AI comparison failed or returned unsupported citations. No answer recommended. Retry the search.' : 'AI comparison is not configured. No answer recommended. Ask the workspace reviewer queue.', citations: [] }; }
    }
    // Reset or a newer operation must never be resurrected by an in-flight search.
    if (searches.get(q.id) !== pending || !store.questions.some(item => item.id === q.id && item.tenantId === q.tenantId)) fail('CONFLICT', 'The issue changed during search. Open the current ticket again.');
    store.sources = [...store.sources.filter(source => source.tenantId !== q.tenantId || source.questionId !== q.id), ...retrieved];
    searches.set(q.id, state);
    append(q, 'Knowledge searched', q.id, state.message + '\nComparison: ' + (state.relationship ?? 'unavailable') + '\nCitations: ' + JSON.stringify(state.citations));
    return getScenario(q.id);
  } catch (error) { if (error instanceof Failure) return { ok: false, error: error.detail }; return { ok: false, error: { code: 'SERVICE_ERROR', message: 'Unable to complete this search.' } }; }
}


