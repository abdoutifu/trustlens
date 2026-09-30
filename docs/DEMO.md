# Demo walkthrough

[← Back to TrustLens](../README.md) · [Watch the 1:52 demo](https://github.com/abdoutifu/trustlens/releases/download/hackathon-demo-2026/TrustLens-demo.mp4)

## Start here

1. Run the local app and sign in as **reviewer@trustlens.demo** with **ReviewerDemo!**.
2. Open **New issue**, enter a payroll question and its context, then select **Check trusted knowledge**.
3. Inspect the retrieved sources, exact clauses and trust contributions.
4. Validate sufficient evidence, or escalate unresolved disagreement.
5. Open **Verified cards** to inspect the review record and reuse the answer.

New issues use live server-side AI comparison when an OpenAI key is configured. The sample decisions below work without a key. Payroll documents and owners are demonstration fixtures.

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

## Recording

The video begins at login and shows real issue creation, source retrieval, exact citations, review and reuse in a second issue. Its conversational narration is AI-generated. No app results are fabricated.

The recording and Aikido evidence are separate submission items. A repository scan screenshot is not, by itself, evidence that an AI Code Audit completed.
