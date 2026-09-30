import { TriangleAlert } from 'lucide-react';
import { sources, type Role, type Source } from '../data/scenario';
import { recommendation, score } from '../lib/scoring';
import { QuestionCard } from '../components/QuestionCard';
import { SourceCard } from '../components/SourceCard';
import { KnowledgeDiff } from '../components/KnowledgeDiff';
import { TrustBreakdown } from '../components/TrustBreakdown';
import { RecommendationBanner } from '../components/RecommendationBanner';
export function Decision({ selected, select, role, rejected, onReject, onEscalate, onValidate, inspect }: { selected: Source; select: (s: Source) => void; role: Role; rejected: boolean; onReject: () => void; onEscalate: () => void; onValidate: () => void; inspect: (s: Source) => void }) {
  const result = recommendation(sources);
  return <><QuestionCard confident={result.state === 'confident' && !rejected} /><div className="decision-grid"><section className="sources-column" aria-labelledby="sources-heading"><div className="column-heading"><h2 id="sources-heading">Source<br className="desktop-break" /> Documents</h2><div className="source-heading-meta"><span className="found-badge">4 Found</span><span>Ranked by Trust</span></div></div><div className="source-list">{sources.map(source => <SourceCard key={source.id} source={source} selected={source.id === selected.id} onSelect={() => select(source)} />)}</div></section>
    <div className="diff-column"><div className="column-heading"><h2>Knowledge Diff</h2><span className="conflict-badge"><TriangleAlert size={16} />1 Conflict Detected</span><span className="analysis-label">Semantic Analysis</span></div><KnowledgeDiff source={selected} inspect={inspect} /></div>
    <div className="trust-column"><div className="column-heading"><h2>Trust Breakdown</h2><span className="total-score">{Math.round(score(selected))} / 100</span></div><TrustBreakdown source={selected} /></div></div>
    <RecommendationBanner result={result} role={role} rejected={rejected} onReject={onReject} onEscalate={onEscalate} onValidate={onValidate} />
    <details className="rejected-sources"><summary>{result.rejected.length} sources excluded from the recommendation</summary><ul>{result.rejected.map(({ source, reasons }) => <li key={source.id}><strong>{source.title}</strong><span>{reasons.join(' ')}</span></li>)}</ul></details></>;
}
