# TrustLens

**Find it. Understand it. Trust it.** A local SD Worx hackathon demo for resolving organizational knowledge conflicts. The existing React + Vite + TypeScript + Tailwind application retains its header, sidebar, question area, three-column Decision view, recommendation bar, Verified cards and Compliance Rules.

## Run and verify

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

Vite serves the demo at its printed local address, normally http://127.0.0.1:5173. `npm run preview` previews the built app. There is no configured lint tool. Tests use the existing Node test runner through tsx, with no test-framework migration.

## Demo login

| Account | Public demo password | Access |
| --- | --- | --- |
| reader@trustlens.demo | ReaderDemo! | Read decisions and verified cards |
| reviewer@trustlens.demo | ReviewerDemo! | Read, validate, escalate, resolve and reset |
| admin@trustlens.demo | AdminDemo! | All review actions plus audit log |

The login screen displays these credentials. Account selection fills the login form; it does not bypass login. The service stores and compares deliberately non-cryptographic mock hashes. It derives userId, name, role and tenantId from its private account fixtures. There is no role or tenant dropdown. Log out and sign in to use another account.

**This is demo authentication, not production security.** Credentials are public by design. The local Node service holds data and opaque HttpOnly cookie sessions. Refresh preserves the session; restarting the service restores seed data. Logging out preserves review state. Public demo accounts and mock password hashes are not production identity.

## Active Queue and sample decisions

Sign-in and Reset demo open the Active Queue without selecting a question. Created issues appear in the queue; the two seeded cases remain available under the closed Sample decisions panel. The seed documents stay available for real knowledge search.

### A — Payroll correction after cutoff

Belgian Payroll Policy 2026 wins with a calculated score of **88.4**. The 2023 manual is outdated; the France policy has the wrong country; the Teams export is ownerless/unverified. They remain inspectable but cannot be current authority. The view reports **1 superseded rule found**, zero unresolved conflicts and **High Confidence**. The loaded-source count comes from real state; there is no pretend sync timestamp.

### B — Part-time overtime approval

Belgian HR Policy 2026 (Sofie Claes, **80.6**) requires prior written approval. Collective Agreement Addendum 2025 (Jan Peeters, **79.0**) permits retrospective approval for urgent overtime. Both are valid Belgian sources; their **1.6-point gap** triggers **Two valid sources disagree. Ask the owner.** An expired verified answer remains visibly **Expired**, excluded as current authority.

As Reviewer or Admin:

1. Open the part-time overtime ticket.
2. Select sources, compare the two clauses and inspect trust contributions.
3. Escalate to the owner.
4. Select the applicable clause and record the owner-resolution reason.
5. Validate the resolved clause with a review reason and future review-by date.
6. The newly created verified card immediately appears as a reusable source with authority **100**. It becomes the recommendation on the next evaluation. Both original clauses remain traceable.

The optional Demo guide starts closed. While open, **N** advances a step. It ignores inputs, textareas, selects and editable text, as well as modifier shortcuts. Reset demo restores seed cards, clears this tenant’s escalations and audit, and retains the current login. Reader cannot reset.

## Service boundary

`src/lib/api.ts` is the asynchronous HTTP facade. `server/store.ts` owns the single in-memory domain store and enforces protected reads/actions:

```text
login / logout / getSession
createIssue / findKnowledge / getScenario / getSources
validateAnswer / escalate / resolveEscalation
getVerifiedCards / getAuditLog / resetDemo
```

Components display snapshots and service-provided capabilities. They never mutate cards/audit or make authorization decisions. Every protected operation authenticates in the service. ID lookups match **ID + session tenant + question**. Fixtures include inaccessible other-tenant question/source/card/escalation IDs so isolation tests exercise real entities. Unknown IDs and cross-question references fail with the same NOT_FOUND response.

Validation checks at the service boundary:

- Trimmed reason: 3–500 characters.
- Review-by: a real calendar date, strictly later than today in Europe/Brussels, no more than 24 calendar months away.
- Nonempty claim matching the selected source clause; accountable owner matching that source.
- Source and claim bound to the current tenant and question.
- Eligible recommended clause; unresolved disagreement must first be resolved.

Errors use `{ code, message, field? }`. The UI shows returned errors. Client-side form constraints are only conveniences, not authorization or validation enforcement.

## Scoring and audit

`src/lib/scoring.ts` is the single scoring authority. It returns state, confidence label, recommendation, valid/excluded sources, flags, unresolved-conflict count, gap, scores, factor contributions and action availability. Weights remain **35% context / 30% authority / 20% freshness / 15% corroboration**.

Invalid sources never corroborate current authority. Evidence must belong to the same tenant/question and pass country, owner, context, authority and expiry checks; references to invalid document sources are also rejected. The RSZ/ONSS attestation is a simulated supporting fixture, not an externally verified document.

Any unresolved valid-source disagreement prevents High Confidence, including wider score gaps. A recorded resolution selects the applicable clause; validation makes that reviewed answer reusable. Expired cards are visible but cannot serve as recommendations or resolution authority. The pending resolution is consumed when a card is validated, so it cannot silently continue as current authority after that card expires. Empty questions and unknown countries are unsupported; no eligible source means no recommendation.

Audit entries contain id, tenantId, questionId, actor, role, action, target, reason, timestamp, previousHash and hash. Entries and returned snapshots are recursively frozen. Only internal append exists; no update/delete API is exposed. Each new entry hashes a deterministically sorted canonical payload containing the previous hash. Chains are scoped per tenant and ticket. Admin reads audit only for the current ticket/tenant; non-Admins do not receive entries or counts.

The mock hash demonstrates an append-only trace; it is **not cryptographic or production tamper protection**. Reset is an explicit demo-seed restoration exception. Store data exists only in local server memory.

## Design

Paper `#F4F2EC`, ink `#16181D`, accent `#1F3A93`, green `#2F6B4F`, amber `#B7791F`, red `#A63A32`. Newsreader titles, IBM Plex Sans body/UI and IBM Plex Mono evidence math/dates/hashes are bundled locally. The existing layout uses hairline borders, maximum 6px corners, no gradients/glow and no card shadows. Trust rings are replaced with weighted horizontal segments. Legal redlines use strikethrough/underline plus text labels. Trust rows expose weighted contributions and the underlined total. Body text is at least 14px, keyboard focus is visible, and all motion is under 250ms with reduced-motion support.

## Checks and limits

Focused scoring/service tests cover roles, tenant isolation/IDOR, unknown IDs, validation boundaries, expiry, confidence contradictions, corroboration, Ticket B resolution and reuse, frozen audit/hash chains and reset. Browser verification covers login, both tickets, typed validation errors, escalation/resolution/validation/reuse, expired cards, Admin audit, guide shortcuts and responsive layout.

All payroll claims, owner statements, evidence attestations and clause-reference hashes are simulated. Escalation records a local owner-review workflow; it sends no message. Real identity, persistent/tamper-resistant audit storage, ingestion, verified payroll policy and owner messaging remain production work. Official Aikido results are supplied separately. Local tests and ECC reviews do not establish an Aikido audit result. ECC code and final security reviews are used for this demo’s implementation.

## Create → Find → Understand → Trust

Reviewer and Admin can create an issue with question, country, customer and payroll year. Creating an issue immediately starts knowledge search. The interface shows actual retrieval/comparison progress, then focuses the result and briefly highlights its recommended source. Find knowledge searches only available tenant knowledge in the requested context, then sends retrieved excerpts to OpenAI for a constrained comparison. Recommendations cite exact source references and quotes. AI cannot create sources, change scores, supply owners or override invalid-source checks. Unresolved eligible disagreement requires owner review. Missing configuration, invalid AI evidence, failed requests and no results fail closed: no answer is validated by guessing.

Configure a **rotated** key in an ignored root `.env` file:

```dotenv
OPENAI_API_KEY=your_rotated_key
OPENAI_MODEL=gpt-4.1-mini
```

Restart the local service after changing configuration. Do not use a `VITE_` key variable: those are public client variables. The supplied key was exposed in conversation; it is deliberately not embedded in code or checked in. Seeded tickets work without a key and are clearly simulated; newly created issues require successful live comparison. `.env.example` lists server configuration without credentials. No API key is sent to the browser. Search sends the question and candidate excerpts to OpenAI; source data is demo content only. This is a local demo server, not a public deployment.

Search audit entries record the classification and exact source citations accepted, not an untrusted AI narrative. Verified cards preserve the reviewed source reference and exact quotation even if a later search returns new source IDs. UI request generations prevent old searches or previews from replacing a newer ticket, and sequence checks prevent a slower source preview from replacing a later selection. Review confirmations identify the next action; reviewed cards reopen their cited decision, and expired cards reopen for comparison only. Ticket switching and navigation restore the result position. The 1920×1080 decision and modal layouts were checked. Live-provider tests use controlled responses for success, insufficient evidence, conflicts and forged citations; a live server-side comparison was also exercised in the local browser without revealing or committing its configured key.

OpenAI integration follows the official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). Identical clauses from a policy and its verified card are compared once. After exact-quote verification, citations are expanded only to existing retrieved sources with the same country and identical claim. Different clauses stay separate, and missing or invented representative citations fail closed. Legal redlines use the retrieved evidence rather than seeded IDs and show exact source wording.

Schema conformance is followed by application checks for complete, unique source IDs and exact quotations; it is not proof that an AI relevance assessment is infallible.
