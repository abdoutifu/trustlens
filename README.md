# TrustLens

**Find it. Understand it. Trust it.** A local conflict-resolution layer for organizational knowledge, built for the SD Worx hackathon challenge. The Decision view follows the supplied enterprise dashboard mockup, with the requested Payroll Review label and live audit-entry count.

## Run

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local address printed by Vite (normally http://127.0.0.1:5173). No environment variables, keys, accounts, or external services are required. Inter is bundled locally.

```sh
npm run build
npm test
npm run preview
```

## Implementation steps

1. **Scaffold, data, and scoring:** React + Vite + TypeScript + Tailwind CSS; all scenario data in `src/data/scenario.ts`; calculated scores and shared role permissions in `src/lib/scoring.ts`.
2. **Decision screen:** screenshot-based navigation, sidebar, inquiry, four selectable source cards, animated score rings, claim comparison, factor breakdown, recommendation, and expandable rejection reasons. Source references open local excerpts.
3. **Review workflow:** accessible native validation dialog, required review fields, verified cards, Admin audit table, read-only compliance rules, escalation and rejection toasts. Tabs use React state without a router.
4. **ECC reviews and documentation:** ECC planner guidance, frontend-design-direction skill, independent code-reviewer review, final security-review skill review, and this README.

```text
src/
  data/scenario.ts
  lib/scoring.ts
  lib/scoring.test.ts
  components/
    TopNav.tsx
    Sidebar.tsx
    QuestionCard.tsx
    SourceCard.tsx
    ScoreRing.tsx
    KnowledgeDiff.tsx
    TrustBreakdown.tsx
    RecommendationBanner.tsx
    ValidateModal.tsx
  pages/
    Decision.tsx
    VerifiedCards.tsx
    AuditTrail.tsx
    ComplianceRules.tsx
  App.tsx
  main.tsx
  index.css
```

## Try the demo

- Start as **Reviewer**. Select each source to inspect its comparison and factors. The recommendation stays anchored to the highest-scoring eligible source.
- Choose **Validate this answer**, add a reason and a review-by date, and submit. The new answer appears in **Verified cards** and the audit count increases.
- Choose **Escalate to owner** to append an escalation entry and see Marie Dubois in the toast. This does not send a message.
- Choose **Admin** to view **Audit Trail**. Switching away from Admin closes access to that view.
- Choose **Reader** to see validation and escalation disabled. The same permission function also checks action handlers.
- **Not right** flags the recommendation for owner review, adds an audit entry, and disables validation for the rest of the session. Reload to reset the demo.
- Review dates use the Europe/Brussels calendar. Past dates are expired and show **Needs re-verification**; dates within 14 days are **Expiring soon**; later dates are **Valid**. New cards cannot be created with a past review date.

## Scores and recommendation

Weights are context 35%, authority 30%, freshness 20%, corroboration 15%. Totals are calculated, never stored in the source fixtures:

| Source | Exact weighted score | Ring display |
| --- | ---: | ---: |
| Belgian Payroll Policy 2026 | 88.4 | 88 |
| Belgian Payroll Manual v3 | 54 | 54 |
| France Payroll Correction Policy | 30.75 | 31 |
| Teams message #payroll-be | 37.75 | 38 |

The current Belgian policy is the only eligible recommendation. The other sources are excluded for outdated guidance, wrong jurisdiction, or missing ownership/verification. Context and authority eligibility thresholds are both 75. Confident recommendations need a score of at least 75 and a lead of at least 15 points; a single eligible source has no competing score. Two eligible sources less than 15 points apart produce the specified uncertain message. Exactly 15 points qualifies as confident.

Corroboration evidence is explicitly modeled in the local fixtures. The policy's 52 points represent a simulated authoritative RSZ/ONSS attestation. The chat's 15 points represent limited overlap with the eligible current Belgian policy; the chat itself remains rejected. Each supporting evidence record must pass country, owner, context, and authority checks before contributing. Invalid sources do not corroborate other sources. These evidence records are supporting fixture metadata, not additional document cards.

## What's simulated

The question, customer, payroll rules, approval, clause references, diff hashes, factor scores, sync timestamp, evidence attestations, identity, role selection, and owner escalation are hard-coded demo content. Payroll claims are scenario text, not independently verified policy. The context dropdowns contain the one supplied scenario. Notifications and help are local explanatory toasts.

Verified cards and audit entries live only in React memory and reset on reload. Audit entries are append-only through the application interface. The role dropdown demonstrates permissions; it is not authentication or a tamper-proof security boundary. No backend, SSR, API calls, telemetry, browser storage, or external font calls are used.

## What's unfinished for production

Real document ingestion, authenticated roles, server-side authorization, persistent/tamper-resistant audit storage, actual owner notifications, live policy verification, real sync, context switching, and re-verification workflows are outside this local demo. A production deployment would need those services and independently validated payroll policies.

## Verification and security review

- Production TypeScript/Vite build passed.
- All eight automated tests passed: weighted scores, rejection, confidence boundaries, uncertain decisions, corroboration gates, roles, Brussels date expiry, and input validation.
- Browser checks passed at 1600px desktop and 390px mobile with no horizontal overflow: source selection, validation-to-card flow, expiring-soon status, audit creation, Admin audit access, Reader restrictions, and owner escalation.
- Reader restrictions remained in place even after browser button disabled attributes were removed during testing. Role guards were also verified in the action-handler source.
- ECC independent code review: **APPROVE**, zero findings.
- ECC final security review: **PASS**, zero findings. Plain React text rendering; shared permission checks in UI and handlers; required/length/date checks at the action boundary; no secrets or unsafe HTML; `.env` and `.env.*` ignored.
- npm dependency audit: **0 vulnerabilities** when installed. Lockfile included.
- An Aikido scan has not been run. The code is ready for a separate scan; the ECC review is not an Aikido scan result.
- This is a new local directory without Git history, so a historical secret scan was not applicable.

Assumptions: Reviewer is the default role; only Admin sees Audit Trail; the supplied Belgium/Acme NV/2026 scenario and corroboration attestations are fixed demo fixtures; all review state resets on reload.
