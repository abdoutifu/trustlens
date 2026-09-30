export type Factor = 'context' | 'authority' | 'freshness' | 'corroboration';
export type Flag = 'approved' | 'outdated' | 'conflicts' | 'wrong_country' | 'no_owner' | 'unverified' | 'expired' | 'verified';
export type Role = 'Reader' | 'Reviewer' | 'Admin';
export type Tab = 'Decision' | 'Verified cards' | 'Audit Trail' | 'Compliance Rules';
export interface ScopedEntity { id: string; tenantId: string; questionId: string }
export interface Evidence extends ScopedEntity { country: string; owner: string; context: number; authority: number; agreement: number; flags: Flag[]; reviewBy?: string }
export interface Source extends ScopedEntity {
  id: string; title: string; owner: string | null; country: string; date: string; flags: Flag[];
  factors: Record<Factor, number>; reasons: Record<Factor, string>; claim: string;
  reference: string; hash: string; discrepancy: string; evidence: Evidence[];
  stance: string; kind: 'document' | 'verified'; reviewBy?: string;
}
export interface Scenario extends ScopedEntity { ticket: string; title: string; question: string; context: { country: string; countryCode: string; customer: string; year: number }; supersededOn?: string }
const tenantId = 'acme';
const questionId = 'ticket-a';
export const scenario: Scenario = {
  id: questionId, tenantId, questionId, title: 'Payroll correction after cutoff',
  ticket: 'TL-8492', question: "Can this Belgian customer correct an employee's payroll after the monthly cutoff?",
  context: { country: 'Belgium', countryCode: 'BE', customer: 'Acme NV', year: 2026 },
  supersededOn: 'Jan 12, 2026',
};
export const sources: Source[] = [
  {
    id: 's1', tenantId, questionId, stance: 'retroactive-day20', kind: 'document', title: 'Belgian Payroll Policy 2026', owner: 'Marie Dubois', country: 'BE', date: 'Jan 2026', flags: ['approved'],
    factors: { context: 100, authority: 92, freshness: 90, corroboration: 52 },
    reasons: {
      context: 'Matches Belgium statutory jurisdiction and Acme NV payroll tier.',
      authority: 'Owned and signed off by lead compliance legal officer Marie Dubois.',
      freshness: 'Ratified and effective as of January 1, 2026.',
      corroboration: 'Cross-referenced against Belgian Social Security (RSZ/ONSS) directives.',
    },
    claim: 'Belgian statutory regulations enforce that corrections after submission require formal retroactive filing once past cutoff day 20; retroactive declarations apply.',
    reference: 'View clause 8.1 in Belgian Payroll Policy 2026', hash: '8f02a9b',
    discrepancy: 'Cutoff deadline shifted by 5 calendar days under the 2026 collective bargaining agreement. 2023 manual is invalid for 2026 submissions.',
    evidence: [{ id: 'rsz-onss-directives', tenantId, questionId, flags: ['approved'], country: 'BE', owner: 'RSZ/ONSS', context: 100, authority: 95, agreement: 52 }],
  },
  {
    id: 's2', tenantId, questionId, stance: 'no-signoff-day15', kind: 'document', title: 'Belgian Payroll Manual v3', owner: 'HR Ops Archive', country: 'BE', date: 'Jun 2023', flags: ['outdated', 'conflicts'],
    factors: { context: 100, authority: 50, freshness: 20, corroboration: 0 },
    reasons: { context: 'Matches Belgian jurisdiction and the Acme NV payroll context.', authority: 'Archived HR guidance; no current policy approval.', freshness: 'Published in June 2023 and superseded in January 2026.', corroboration: 'No eligible current source agrees with the day 15 rule.' },
    claim: 'Corrections to submitted timesheets and salary adjustments can be processed up until cutoff day 15 of the current pay cycle without senior director sign-off.',
    reference: 'View sec. 4.2 in Belgian Payroll Manual v3', hash: '3c91b6e',
    discrepancy: 'This manual uses cutoff day 15. The approved 2026 policy replaces it with cutoff day 20 and a formal retroactive filing requirement.', evidence: [],
  },
  {
    id: 's3', tenantId, questionId, stance: 'france-filing', kind: 'document', title: 'France Payroll Correction Policy', owner: 'Pierre Lefebvre', country: 'FR', date: 'Jan 2026', flags: ['wrong_country'],
    factors: { context: 5, authority: 90, freshness: 10, corroboration: 0 },
    reasons: { context: 'French jurisdiction does not apply to this Belgian customer.', authority: 'Owned and approved by French payroll lead Pierre Lefebvre.', freshness: 'Recent publication, but not effective in the Belgian context.', corroboration: 'French guidance cannot corroborate Belgian payroll rules.' },
    claim: 'French payroll corrections follow the French declaration process and local submission calendar.',
    reference: 'View France Payroll Correction Policy', hash: '4a12f7c',
    discrepancy: 'Jurisdiction mismatch: this policy applies to France. It cannot establish the cutoff or filing requirements for Acme NV in Belgium.', evidence: [],
  },
  {
    id: 's4', tenantId, questionId, stance: 'unconfirmed', kind: 'document', title: 'Teams message #payroll-be', owner: null, country: 'BE', date: 'Dec 2025', flags: ['no_owner', 'unverified'],
    factors: { context: 80, authority: 5, freshness: 30, corroboration: 15 },
    reasons: { context: 'Mentions Belgium payroll, but does not identify the customer.', authority: 'Internal chat export with no accountable owner or approval.', freshness: 'December 2025 discussion predates the active policy.', corroboration: 'Limited filing-process overlap with the approved Belgian policy.' },
    claim: 'A payroll chat suggests late corrections may be possible; the filing process and cutoff are not confirmed.',
    reference: 'View Teams message #payroll-be', hash: '7d65e2a',
    discrepancy: 'No accountable owner or verified deadline. Partial agreement on the filing process does not make this chat an authoritative answer.',
    evidence: [{ id: 's1', tenantId, questionId, flags: ['approved'], country: 'BE', owner: 'Marie Dubois', context: 100, authority: 92, agreement: 15 }],
  },
];
export interface VerifiedCard extends ScopedEntity { sourceId: string; citation?: { sourceId: string; reference: string; quote: string }; title: string; claim: string; stance: string; country: string; reason: string; owner: string; reviewBy: string; createdAt: string; verifiedBy: string }
export interface AuditEntry extends ScopedEntity { actor: string; role: Role; action: string; target: string; reason: string; timestamp: string; previousHash: string; hash: string }
export interface Escalation extends ScopedEntity { sourceId: string; owner: string; reason: string; status: 'open' | 'resolved'; selectedSourceId?: string; resolutionReason?: string; validatedCardId?: string; createdAt: string; resolvedAt?: string }
export interface Capabilities { canValidate: boolean; canEscalate: boolean; canResolve: boolean; canViewAudit: boolean; canReset: boolean }
export interface Session { userId: string; name: string; role: Role; tenantId: string; capabilities: Capabilities }
export const ticketB: Scenario = { id: 'ticket-b', questionId: 'ticket-b', tenantId, ticket: 'TL-8493', title: 'Part-time overtime approval', question: 'Does overtime for part-time employees in Belgium need prior approval?', context: { ...scenario.context } };
const commonReasons = { context: 'Matches Belgium + Acme NV.', authority: 'Approved owner-backed policy.', freshness: 'Effective for the 2026 payroll year.', corroboration: 'No eligible source corroborates this approval clause.' };
export const ticketBSources: Source[] = [
  { id: 'b-s1', tenantId, questionId: 'ticket-b', title: 'Belgian HR Policy 2026', owner: 'Sofie Claes', country: 'BE', date: 'Jan 2026', flags: ['approved'], kind: 'document', stance: 'prior-approval', factors: { context: 100, authority: 92, freshness: 90, corroboration: 0 }, reasons: { ...commonReasons }, claim: 'Part-time employees must obtain prior written approval from their manager before working overtime.', reference: '§ 6.2 · Belgian HR Policy 2026', hash: 'b601a2f', discrepancy: 'The HR policy requires prior written approval. The collective agreement allows approval after urgent overtime. Both sources are valid; owner review is required.', evidence: [] },
  { id: 'b-s2', tenantId, questionId: 'ticket-b', title: 'Collective Agreement Addendum 2025', owner: 'Jan Peeters', country: 'BE', date: 'Dec 2025', flags: ['approved'], kind: 'document', stance: 'urgent-retrospective', factors: { context: 100, authority: 90, freshness: 85, corroboration: 0 }, reasons: { ...commonReasons, authority: 'Signed collective agreement owned by Jan Peeters.', freshness: 'December 2025 addendum remains in effect in 2026.' }, claim: 'For urgent overtime, part-time employees may obtain manager approval retrospectively within two working days; prior approval is not required.', reference: '§ 3.4 · Collective Agreement Addendum 2025', hash: 'b34c5d8', discrepancy: 'This addendum permits retrospective approval for urgent overtime, contrary to the HR policy’s prior written approval requirement.', evidence: [] },
];
export const seedVerifiedCards: VerifiedCard[] = [{ id: 'b-expired-card', tenantId, questionId: 'ticket-b', sourceId: 'b-s1', title: 'Verified overtime answer · previous review', claim: 'Prior approval is always required for part-time overtime.', stance: 'prior-approval', country: 'BE', owner: 'Sofie Claes', reason: 'Prior review; re-verification is overdue.', reviewBy: '2025-01-01', createdAt: '2024-12-01T12:00:00Z', verifiedBy: 'Demo seed reviewer' }];
// Separate tenant fixtures make IDOR tests exercise real, inaccessible IDs.
export const otherTenantQuestion: Scenario = { ...scenario, id: 'other-ticket', questionId: 'other-ticket', tenantId: 'other-company', ticket: 'OTHER-1' };
export const otherTenantSource: Source = { ...sources[0], id: 'other-source', tenantId: 'other-company', questionId: 'other-ticket', evidence: [] };
export const seededQuestions = [scenario, ticketB, otherTenantQuestion];
export const seededSources = [...sources, ...ticketBSources, otherTenantSource];
