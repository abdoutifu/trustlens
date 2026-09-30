import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../../server/store';
import { checkComparison, compareSources } from '../../server/compare';
import { sources, scenario } from '../data/scenario';
import { reviewDateBounds } from './scoring';
function unwrap<T>(result: api.Result<T>): T { if (!result.ok) assert.fail(result.error.message); return result.data; }
const question = { question: scenario.question, countryCode: 'BE', customer: 'Acme NV', year: 2026 };
beforeEach(() => { unwrap(api.login('admin@trustlens.demo', 'AdminDemo!')); unwrap(api.resetDemo()); });
function fakeAI(relation = 'agreement', mutate?: (citations: {sourceId:string;quote:string}[]) => void) {
  const original = globalThis.fetch; const key = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-placeholder';
  globalThis.fetch = (async (_url, init) => {
    const request = JSON.parse(String(init?.body)); const input = JSON.parse(request.input);
    const citations = input.sources.map((s: {sourceId:string;claim:string}) => ({sourceId:s.sourceId,quote:s.claim})); mutate?.(citations);
    return new Response(JSON.stringify({ output: [{ content: [{ type:'output_text', text: JSON.stringify({relationship:relation,answersQuestion:relation !== 'insufficient',citations}) }] }] }), {status:200});
  }) as typeof fetch;
  return () => { globalThis.fetch = original; if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; };
}
test('issue creation requires review permission and validates context server-side', () => {
  unwrap(api.login('reader@trustlens.demo','ReaderDemo!')); assert.equal(api.createIssue(question).ok,false);
  unwrap(api.login('reviewer@trustlens.demo','ReviewerDemo!'));
  for (const change of [{question:'short'},{countryCode:'XX'},{customer:''},{year:2040}]) assert.equal(api.createIssue({...question,...change}).ok,false);
  const issue = unwrap(api.createIssue(question)); assert.equal(issue.question.tenantId,'acme'); assert.equal(issue.evaluation.canValidate,false); assert.equal(issue.sources.length,0);
});
test('new issue cannot validate before grounded search; missing AI configuration fails closed', async () => {
  const key = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { const issue=unwrap(api.createIssue(question)); const found=unwrap(await api.findKnowledge(issue.question.id)); assert.equal(found.search?.status,'error'); assert.equal(found.evaluation.canValidate,false); assert.equal(found.evaluation.top,undefined); const source=found.sources[0]; assert.equal(api.validateAnswer({questionId:issue.question.id,sourceId:source.id,claim:source.claim,owner:source.owner!,reason:'Owner-approved clause',reviewBy:reviewDateBounds().min}).ok,false); }
  finally { if(key!==undefined) process.env.OPENAI_API_KEY=key; }
});
test('search does not borrow another tenant/customer/country context', async () => {
  for (const change of [{customer:'Other NV'},{countryCode:'FR'},{year:2025},{question:'How do we arrange office catering deliveries?'}]) { const issue=unwrap(api.createIssue({...question,...change})); const found=unwrap(await api.findKnowledge(issue.question.id)); assert.equal(found.search?.status,'empty'); assert.equal(found.evaluation.top,undefined); assert.equal(found.evaluation.canValidate,false); }
});
test('no evidence can be escalated without inventing a source or owner', async () => {
  const issue=unwrap(api.createIssue({...question,question:'How do we arrange office catering deliveries?'})); await api.findKnowledge(issue.question.id);
  const escalation=unwrap(api.escalate(issue.question.id,'','No matching evidence; accountable review is required.')); assert.equal(escalation.sourceId,''); assert.equal(api.resolveEscalation(issue.question.id,escalation.id,'s1','Use a different ticket source').ok,false);
});
test('AI cannot invent source IDs or alter exact quotations', () => {
  assert.throws(()=>checkComparison({relationship:'agreement',answersQuestion:true,citations:[{sourceId:'foreign-id',quote:sources[0].claim}]},[sources[0]]));
  assert.throws(()=>checkComparison({relationship:'agreement',answersQuestion:true,citations:[{sourceId:sources[0].id,quote:'Invented legal rule'}]},[sources[0]]));
});
test('grounded AI evidence flows into scoring and exact cited recommendation', async () => {
  const restore=fakeAI(); try { const issue=unwrap(api.createIssue(question)); const found=unwrap(await api.findKnowledge(issue.question.id)); assert.equal(found.search?.status,'ready'); assert.equal(found.evaluation.state,'confident'); assert.ok(found.search!.citations.some(c=>c.sourceId===found.evaluation.top?.id && c.quote===found.evaluation.top.claim)); assert.equal(found.evaluation.conflictCount,0); }
  finally {restore();}
});
test('AI disagreement cannot be hidden behind high confidence', async () => {
  const restore=fakeAI('conflict'); try {const issue=unwrap(api.createIssue(question)); const found=unwrap(await api.findKnowledge(issue.question.id)); assert.equal(found.evaluation.canValidate,false); assert.notEqual(found.evaluation.confidenceLabel,'High Confidence');}
  finally {restore();}
});
test('AI insufficient evidence and forged citations fail closed', async () => {
  for (const [relation,mutate] of [['insufficient',undefined],['agreement',(citations:{sourceId:string;quote:string}[])=>{citations[0].quote='fabricated';}]] as const) { const restore=fakeAI(relation,mutate); try {const issue=unwrap(api.createIssue(question)); const found=unwrap(await api.findKnowledge(issue.question.id)); assert.equal(found.evaluation.canValidate,false); assert.equal(found.evaluation.top,undefined);} finally {restore();} }
});
test('AI agreement cannot suppress two current conflicting sources', async () => {
  const restore=fakeAI('agreement'); try { const issue=unwrap(api.createIssue({...question,question:'Does overtime for part-time employees in Belgium need prior approval?'})); const found=unwrap(await api.findKnowledge(issue.question.id)); assert.equal(found.evaluation.state,'escalation'); assert.equal(found.evaluation.canValidate,false); }
  finally {restore();}
});
test('request-local Reader identity cannot inherit concurrent Admin permissions', async () => {
  const admin=unwrap(api.login('admin@trustlens.demo','AdminDemo!')); const reader=unwrap(api.login('reader@trustlens.demo','ReaderDemo!'));
  await Promise.all([api.requestContext.run({session:admin},async()=>{await Promise.resolve(); assert.equal(api.getAuditLog('ticket-a').ok,true);}),api.requestContext.run({session:reader},async()=>{await Promise.resolve(); assert.equal(api.getAuditLog('ticket-a').ok,false); assert.equal(api.createIssue(question).ok,false);})]);
});
test('verified answers preserve exact evidence and are retrieved for a later issue', async () => {
  const restore=fakeAI(); try {
    const first=unwrap(api.createIssue(question)); const found=unwrap(await api.findKnowledge(first.question.id)); const source=found.evaluation.top!;
    const card=unwrap(api.validateAnswer({questionId:first.question.id,sourceId:source.id,claim:source.claim,owner:source.owner!,reason:'Applicable current customer policy.',reviewBy:reviewDateBounds().min}));
    assert.deepEqual(card.citation,{sourceId:source.id,reference:source.reference,quote:source.claim}); assert.ok(Object.isFrozen(card.citation));
    const audit=unwrap(api.getAuditLog(first.question.id)); assert.ok(audit.at(-1)!.reason.includes(source.claim)); assert.ok(audit.find(entry=>entry.action==='Knowledge searched')!.reason.includes(source.reference));
    const next=unwrap(api.createIssue(question)); const reused=unwrap(await api.findKnowledge(next.question.id)); assert.ok(reused.sources.some(s=>s.kind==='verified' && s.reference.includes(card.id)));
  } finally {restore();}
});



test('imported verified authority cannot bypass a new grounded disagreement', async () => {
  const clause = unwrap(api.getSources('ticket-b', 'b-s1'))[0];
  const escalation = unwrap(api.escalate('ticket-b', clause.id, 'Owner reviews the original issue.'));
  unwrap(api.resolveEscalation('ticket-b', escalation.id, clause.id, 'Owner confirms prior approval applies.'));
  unwrap(api.validateAnswer({ questionId: 'ticket-b', sourceId: clause.id, claim: clause.claim, owner: clause.owner!, reason: 'Reviewed on the original issue.', reviewBy: reviewDateBounds().min }));
  const restore = fakeAI('conflict');
  try {
    const issue = unwrap(api.createIssue({ ...question, question: 'Does overtime for part-time employees in Belgium need prior approval?' }));
    const found = unwrap(await api.findKnowledge(issue.question.id));
    assert.equal(found.evaluation.top?.kind, 'verified');
    assert.equal(found.evaluation.canValidate, false);
    assert.notEqual(found.evaluation.confidenceLabel, 'High Confidence');
    const source = found.evaluation.top!;
    const rejected = api.validateAnswer({ questionId: issue.question.id, sourceId: source.id, claim: source.claim, owner: source.owner!, reason: 'Attempt to reuse without new owner review.', reviewBy: reviewDateBounds().min });
    assert.equal(rejected.ok, false);
    const currentReview = unwrap(api.escalate(issue.question.id, source.id, 'Review the newly cited disagreement.'));
    unwrap(api.resolveEscalation(issue.question.id, currentReview.id, source.id, 'Owner confirms this clause for this issue.'));
    const card = unwrap(api.validateAnswer({ questionId: issue.question.id, sourceId: source.id, claim: source.claim, owner: source.owner!, reason: 'Owner reviewed the new issue.', reviewBy: reviewDateBounds().min }));
    assert.equal(unwrap(api.getScenario(issue.question.id)).evaluation.top?.id, card.id);
    assert.equal(unwrap(api.getScenario(issue.question.id)).evaluation.canValidate, true);
  } finally { restore(); }
});


test('missing and duplicate exact citations are rejected', () => {
  const evidence = [sources[0], sources[1]];
  const citation = { sourceId: sources[0].id, quote: sources[0].claim };
  assert.throws(() => checkComparison({ relationship: 'agreement', answersQuestion: true, citations: [citation] }, evidence));
  assert.throws(() => checkComparison({ relationship: 'agreement', answersQuestion: true, citations: [citation, citation] }, evidence));
});

test('Reader cannot bypass new-issue actions by supplying a forged role', async () => {
  const issue = unwrap(api.createIssue(question));
  unwrap(api.login('reader@trustlens.demo', 'ReaderDemo!'));
  const result = await api.findKnowledge(issue.question.id);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'FORBIDDEN');
  const forged = api.validateAnswer({ questionId: 'ticket-a', sourceId: 's1', claim: sources[0].claim, owner: sources[0].owner!, reason: 'Attempted role override.', reviewBy: reviewDateBounds().min, role: 'Admin', tenantId: 'acme', capabilities: { canValidate: true } } as api.ValidationInput);
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.error.code, 'FORBIDDEN');
});

test('identical verified clauses are compared once and retain both exact source citations', async () => {
  const original = sources[0];
  const verified = { ...original, id: 'reviewed-copy', reference: 'Reviewed card citation', kind: 'verified' as const };
  const restore = fakeAI();
  try {
    const result = await compareSources(scenario, [original, verified]);
    assert.deepEqual(result.citations, [original, verified].map(source => ({ sourceId: source.id, reference: source.reference, quote: source.claim })));
    assert.equal(result.relationship, 'agreement');
  } finally { restore(); }
});

test('grouping identical clauses never accepts a fabricated representative quotation', async () => {
  const restore = fakeAI('agreement', citations => { citations[0].quote = 'Invented deadline'; });
  try { await assert.rejects(compareSources(scenario, [sources[0], { ...sources[0], id: 'reviewed-copy' }]), /Ungrounded citation/); }
  finally { restore(); }
});
