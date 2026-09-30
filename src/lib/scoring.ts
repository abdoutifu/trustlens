import { scenario, type Evidence, type Factor, type Role, type Source, type VerifiedCard } from '../data/scenario';
export const weights: Record<Factor, number> = { context: 0.35, authority: 0.30, freshness: 0.20, corroboration: 0.15 };
export const factorLabels: Record<Factor, string> = { context: 'Context Match', authority: 'Authority', freshness: 'Freshness', corroboration: 'Corroboration' };
export const factorKeys = Object.keys(weights) as Factor[];
export function permissions(role: Role) { return { canValidate: role === 'Reviewer' || role === 'Admin', canViewAudit: role === 'Admin' }; }
export function passesEvidenceChecks(e: Evidence, country = scenario.context.countryCode) { return e.country === country && !!e.owner.trim() && e.context >= 75 && e.authority >= 75; }
export function effectiveFactors(source: Source) {
  const corroboration = Math.min(source.factors.corroboration, 100, source.evidence.filter(e => passesEvidenceChecks(e)).reduce((total, e) => total + Math.max(0, e.agreement), 0));
  return { ...source.factors, corroboration };
}
export function score(source: Source) { const factors = effectiveFactors(source); return Math.round(factorKeys.reduce((sum, key) => sum + factors[key] * weights[key], 0) * 100) / 100; }
export function rejectionReasons(source: Source) {
  const reasons: string[] = [];
  if (source.country !== scenario.context.countryCode || source.flags.includes('wrong_country')) reasons.push('Wrong country: France does not apply to Belgium.');
  if (!source.owner?.trim() || source.flags.includes('no_owner')) reasons.push('No accountable owner.');
  if (source.flags.includes('outdated')) reasons.push('Outdated: superseded by the 2026 policy.');
  if (source.flags.includes('unverified')) reasons.push('Unverified source.');
  if (source.factors.context < 75) reasons.push('Context check failed.');
  if (source.factors.authority < 75) reasons.push('Authority check failed.');
  return reasons;
}
export function recommendation(items: Source[]) {
  const valid = items.filter(s => rejectionReasons(s).length === 0).sort((a, b) => score(b) - score(a));
  const rejected = items.filter(s => rejectionReasons(s).length > 0).map(source => ({ source, reasons: rejectionReasons(source) }));
  const top = valid[0]; const next = valid[1];
  const gap = top && next ? score(top) - score(next) : Infinity;
  const state = top && score(top) >= 75 && gap >= 15 ? 'confident' : 'uncertain';
  return { state, top, valid, rejected, gap, message: state === 'confident' ? `Use: ${top.title}` : next && gap < 15 ? 'Two valid sources disagree. Ask the owner.' : 'No confident answer. Ask the owner.' };
}
export function dateKey(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function cardStatus(reviewBy: string, now = new Date()) {
  const today = dateKey(now); const days = (Date.parse(reviewBy + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  return days < 0 ? 'expired' : days <= 14 ? 'expiring soon' : 'valid';
}
export function validateCardInput(input: Pick<VerifiedCard, 'claim' | 'reason' | 'owner' | 'reviewBy'>, now = new Date()) {
  if (!input.claim.trim() || input.claim.length > 2000) return 'Enter a claim of 1–2,000 characters.';
  if (!input.reason.trim() || input.reason.length > 1000) return 'Enter a review reason of 1–1,000 characters.';
  if (!input.owner.trim() || input.owner.length > 120) return 'Enter an accountable owner of 1–120 characters.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reviewBy) || !Number.isFinite(Date.parse(input.reviewBy + 'T00:00:00Z')) || new Date(input.reviewBy + 'T00:00:00Z').toISOString().slice(0, 10) !== input.reviewBy || input.reviewBy < dateKey(now)) return 'Choose a valid review-by date today or later.';
  return null;
}
