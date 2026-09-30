export type Factor = 'context' | 'authority' | 'freshness' | 'corroboration';
export type Flag = 'approved' | 'outdated' | 'conflicts' | 'wrong_country' | 'no_owner' | 'unverified';
export type Role = 'Reader' | 'Reviewer' | 'Admin';
export type Tab = 'Decision' | 'Verified cards' | 'Audit Trail' | 'Compliance Rules';
export interface Evidence { id: string; country: string; owner: string; context: number; authority: number; agreement: number }
export interface Source {
  id: string; title: string; owner: string | null; country: string; date: string; flags: Flag[];
  factors: Record<Factor, number>; reasons: Record<Factor, string>; claim: string;
  reference: string; hash: string; discrepancy: string; evidence: Evidence[];
}
export const scenario = {
  ticket: 'TL-8492', question: "Can this Belgian customer correct an employee's payroll after the monthly cutoff?",
  context: { country: 'Belgium', countryCode: 'BE', customer: 'Acme NV', year: 2026 },
  supersededOn: 'Jan 12, 2026',
};
export const sources: Source[] = [
  {
    id: 's1', title: 'Belgian Payroll Policy 2026', owner: 'Marie Dubois', country: 'BE', date: 'Jan 2026', flags: ['approved'],
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
    evidence: [{ id: 'rsz-onss-directives', country: 'BE', owner: 'RSZ/ONSS', context: 100, authority: 95, agreement: 52 }],
  },
  {
    id: 's2', title: 'Belgian Payroll Manual v3', owner: 'HR Ops Archive', country: 'BE', date: 'Jun 2023', flags: ['outdated', 'conflicts'],
    factors: { context: 100, authority: 50, freshness: 20, corroboration: 0 },
    reasons: { context: 'Matches Belgian jurisdiction and the Acme NV payroll context.', authority: 'Archived HR guidance; no current policy approval.', freshness: 'Published in June 2023 and superseded in January 2026.', corroboration: 'No eligible current source agrees with the day 15 rule.' },
    claim: 'Corrections to submitted timesheets and salary adjustments can be processed up until cutoff day 15 of the current pay cycle without senior director sign-off.',
    reference: 'View sec. 4.2 in Belgian Payroll Manual v3', hash: '3c91b6e',
    discrepancy: 'This manual uses cutoff day 15. The approved 2026 policy replaces it with cutoff day 20 and a formal retroactive filing requirement.', evidence: [],
  },
  {
    id: 's3', title: 'France Payroll Correction Policy', owner: 'Pierre Lefebvre', country: 'FR', date: 'Jan 2026', flags: ['wrong_country'],
    factors: { context: 5, authority: 90, freshness: 10, corroboration: 0 },
    reasons: { context: 'French jurisdiction does not apply to this Belgian customer.', authority: 'Owned and approved by French payroll lead Pierre Lefebvre.', freshness: 'Recent publication, but not effective in the Belgian context.', corroboration: 'French guidance cannot corroborate Belgian payroll rules.' },
    claim: 'French payroll corrections follow the French declaration process and local submission calendar.',
    reference: 'View France Payroll Correction Policy', hash: '4a12f7c',
    discrepancy: 'Jurisdiction mismatch: this policy applies to France. It cannot establish the cutoff or filing requirements for Acme NV in Belgium.', evidence: [],
  },
  {
    id: 's4', title: 'Teams message #payroll-be', owner: null, country: 'BE', date: 'Dec 2025', flags: ['no_owner', 'unverified'],
    factors: { context: 80, authority: 5, freshness: 30, corroboration: 15 },
    reasons: { context: 'Mentions Belgium payroll, but does not identify the customer.', authority: 'Internal chat export with no accountable owner or approval.', freshness: 'December 2025 discussion predates the active policy.', corroboration: 'Limited filing-process overlap with the approved Belgian policy.' },
    claim: 'A payroll chat suggests late corrections may be possible; the filing process and cutoff are not confirmed.',
    reference: 'View Teams message #payroll-be', hash: '7d65e2a',
    discrepancy: 'No accountable owner or verified deadline. Partial agreement on the filing process does not make this chat an authoritative answer.',
    evidence: [{ id: 's1', country: 'BE', owner: 'Marie Dubois', context: 100, authority: 92, agreement: 15 }],
  },
];
export interface VerifiedCard { id: string; sourceId: string; title: string; claim: string; reason: string; owner: string; reviewBy: string; createdAt: string; verifiedBy: string }
export interface AuditEntry { id: string; who: string; what: string; when: string; reason: string }
