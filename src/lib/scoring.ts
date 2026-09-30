import type { Evidence, Factor, Scenario, Source, VerifiedCard } from '../data/scenario';
export const weights: Record<Factor, number> = { context: 0.35, authority: 0.30, freshness: 0.20, corroboration: 0.15 };
export const factorLabels: Record<Factor, string> = { context: 'Context', authority: 'Authority', freshness: 'Freshness', corroboration: 'Corroboration' };
export const factorKeys = Object.keys(weights) as Factor[];
export function dateKey(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; }
export function cardStatus(reviewBy: string, now = new Date()) {
  const days = (Date.parse(reviewBy + 'T00:00:00Z') - Date.parse(dateKey(now) + 'T00:00:00Z')) / 86400000;
  return !validDate(reviewBy) || days < 0 ? 'expired' : days <= 14 ? 'expiring soon' : 'valid';
}
export function reviewDateBounds(now = new Date()) {
  const today = dateKey(now); const next = new Date(today + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
  const year = Number(today.slice(0, 4)) + 2; const month = Number(today.slice(5, 7)); const day = Number(today.slice(8));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { min: next.toISOString().slice(0, 10), max: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}` };
}
const invalidFlags = ['outdated', 'wrong_country', 'no_owner', 'unverified', 'expired'];
export function rejectionReasons(source: Source, question: Scenario, now = new Date()) {
  const reasons: string[] = [];
  if (source.tenantId !== question.tenantId || source.questionId !== question.id) reasons.push('Outside this tenant or question.');
  if (source.country !== question.context.countryCode || source.flags.includes('wrong_country')) reasons.push('Wrong country.');
  if (!source.owner?.trim() || source.flags.includes('no_owner')) reasons.push('No accountable owner.');
  if (source.flags.includes('outdated')) reasons.push('Outdated; superseded rule.');
  if (source.flags.includes('unverified')) reasons.push('Unverified source.');
  if (source.flags.includes('expired') || (source.reviewBy && cardStatus(source.reviewBy, now) === 'expired')) reasons.push('Expired; needs re-verification.');
  if (source.factors.context < 75) reasons.push('Context check failed.');
  if (source.factors.authority < 75) reasons.push('Authority check failed.');
  return reasons;
}
export function passesEvidenceChecks(e: Evidence, source: Source, question: Scenario, items: Source[], now = new Date()) {
  if (e.tenantId !== question.tenantId || e.questionId !== question.id || e.country !== question.context.countryCode || !e.owner.trim() || e.context < 75 || e.authority < 75 || e.flags.some(f => invalidFlags.includes(f)) || (e.reviewBy && cardStatus(e.reviewBy, now) === 'expired')) return false;
  const supportingSource = items.find(s => s.id === e.id && s.tenantId === question.tenantId && s.questionId === question.id);
  return e.id !== source.id && (!supportingSource || rejectionReasons(supportingSource, question, now).length === 0);
}
export function effectiveFactors(source: Source, question: Scenario, items: Source[], now = new Date()) {
  const total = source.evidence.filter(e => passesEvidenceChecks(e, source, question, items, now)).reduce((sum, e) => sum + Math.max(0, e.agreement), 0);
  return { ...source.factors, corroboration: Math.min(source.factors.corroboration, 100, total) };
}
export function score(source: Source, question: Scenario, items: Source[], now = new Date()) { const factors = effectiveFactors(source, question, items, now); return Math.round(factorKeys.reduce((sum, key) => sum + factors[key] * weights[key], 0) * 100) / 100; }
export function cardAsSource(card: VerifiedCard): Source {
  return { id: card.id, tenantId: card.tenantId, questionId: card.questionId, title: card.title, owner: card.owner, country: card.country, date: card.createdAt.slice(0, 10), kind: 'verified', reviewBy: card.reviewBy, flags: ['verified'], stance: card.stance, claim: card.claim, factors: { context: 100, authority: 100, freshness: 100, corroboration: 0 }, reasons: { context: 'Verified for this tenant and question.', authority: 'Reviewer-validated, accountable owner.', freshness: `Review by ${card.reviewBy}.`, corroboration: 'No additional supporting evidence credited.' }, evidence: [], reference: `Verified card · ${card.id.slice(0, 8)}${card.citation ? ' · ' + card.citation.reference : ''}`, hash: card.id.slice(0, 8), discrepancy: 'This reviewed answer records the chosen clause. Older documents remain available for comparison.' };
}
export interface Evaluation {
  state: 'confident' | 'escalation' | 'review' | 'none' | 'unsupported'; confidenceLabel: string;
  top?: Source; validSources: Source[]; excludedSources: { source: Source; reasons: string[] }[];
  conflictCount: number; flags: string[]; gap: number | null; message: string;
  scores: Record<string, number>; factors: Record<string, Record<Factor, number>>;
  canValidate: boolean; canEscalate: boolean; canResolve: boolean; resolvedSourceId?: string;
}
export function evaluate(question: Scenario, items: Source[], resolvedSourceId?: string, now = new Date()): Evaluation {
  const scoped = items.filter(s => s.tenantId === question.tenantId && s.questionId === question.id);
  const scores = Object.fromEntries(scoped.map(s => [s.id, score(s, question, scoped, now)]));
  const factors = Object.fromEntries(scoped.map(s => [s.id, effectiveFactors(s, question, scoped, now)]));
  const unsupported = !question.question.trim() || !['BE', 'FR'].includes(question.context.countryCode);
  const validSources = unsupported ? [] : scoped.filter(s => !rejectionReasons(s, question, now).length).sort((a, b) => scores[b.id] - scores[a.id]);
  const excludedSources = scoped.filter(s => !validSources.includes(s)).map(source => ({ source, reasons: unsupported ? ['Unsupported question or country.'] : rejectionReasons(source, question, now) }));
  // Current reviewed authority supersedes competing documents; expired cards never do.
  const verified = validSources.filter(s => s.kind === 'verified').at(-1);
  const resolved = validSources.find(s => s.id === resolvedSourceId);
  const top = resolved ?? verified ?? validSources[0];
  const disagreement = new Set(validSources.map(s => s.stance)).size > 1;
  const conflictCount = disagreement && !verified && !resolved ? 1 : 0;
  const next = validSources.find(s => s.id !== top?.id && s.stance !== top?.stance);
  const gap = top && next ? Math.abs(scores[top.id] - scores[next.id]) : null;
  const state = unsupported ? 'unsupported' : !top ? 'none' : conflictCount ? 'escalation' : scores[top.id] >= 75 ? 'confident' : 'review';
  const confidenceLabel = state === 'confident' ? 'High Confidence' : state === 'escalation' ? 'Owner review required' : state === 'unsupported' ? 'Unsupported context' : state === 'none' ? 'No valid source' : 'Review required';
  const outdatedCount = scoped.filter(s => s.flags.includes('outdated')).length;
  const flags = [outdatedCount ? `${outdatedCount} superseded rule found` : '', conflictCount ? 'Unresolved current disagreement' : '', resolved ? 'Owner resolution recorded' : verified ? 'Verified answer reused' : ''].filter(Boolean);
  return { state, confidenceLabel, top, validSources, excludedSources, conflictCount, flags, gap, scores, factors, resolvedSourceId: resolved?.id, message: state === 'confident' ? `Use ${top!.title}` : state === 'escalation' ? 'Two valid sources disagree. Ask the owner.' : state === 'unsupported' ? 'This question or country is not supported.' : state === 'none' ? 'No valid source. No recommendation available.' : 'No confident answer. Ask the owner.', canValidate: state === 'confident', canEscalate: !!top, canResolve: conflictCount > 0 };
}
