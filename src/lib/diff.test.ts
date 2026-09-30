import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgeDiff } from '../components/KnowledgeDiff';
import { scenario, sources, ticketB, ticketBSources } from '../data/scenario';
import { evaluate } from './scoring';

test('retrieved source IDs retain the genuine payroll redline and exact wording', () => {
  const question = { ...scenario, id: 'created-issue', questionId: 'created-issue' };
  const items = sources.map((source, index) => ({ ...source, id: `retrieved-${index}`, questionId: question.id }));
  const result = evaluate(question, items);
  const html = renderToStaticMarkup(createElement(KnowledgeDiff, { source: items[1], items, question, result, inspect: () => {} }));
  assert.ok(html.includes('Clause delta: +5 days'));
  assert.ok(html.includes('<del>' + items[1].claim + '</del>'));
  assert.ok(html.includes('<ins>' + items[0].claim + '</ins>'));
});

test('newly created overtime issues present unresolved disagreement without seeded IDs', () => {
  const question = { ...ticketB, id: 'created-overtime', questionId: 'created-overtime' };
  const items = ticketBSources.map((source, index) => ({ ...source, id: `retrieved-${index}`, questionId: question.id }));
  const result = evaluate(question, items);
  const html = renderToStaticMarkup(createElement(KnowledgeDiff, { source: items[0], items, question, result, inspect: () => {} }));
  assert.ok(html.includes('Two current clauses disagree'));
  assert.ok(html.includes('Unresolved disagreement'));
});
