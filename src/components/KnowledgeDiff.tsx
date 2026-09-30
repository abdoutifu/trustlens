import { BadgeCheck, Clock3, History, Info, Link2, TriangleAlert } from 'lucide-react';
import { scenario, sources, type Source } from '../data/scenario';
export function KnowledgeDiff({ source, inspect }: { source: Source; inspect: (s: Source) => void }) {
  const current = sources[0]; const comparison = source.id === 's1' ? sources[1] : source;
  const isPolicyDiff = comparison.id === 's2';
  return <section className="diff-panel panel" aria-label="Knowledge comparison"><div className="diff-top"><p className="eyebrow">{isPolicyDiff ? 'Outdated rule vs. active policy' : 'Selected source vs. active policy'}</p><span>{isPolicyDiff ? 'Clause Delta ±5 Days' : 'Context & authority check'}</span></div>
    <div className="claim-grid"><article className="claim deprecated"><div className="claim-heading"><span>{isPolicyDiff ? 'Deprecated (2023)' : comparison.country === 'FR' ? 'Wrong jurisdiction' : 'Unverified claim'}</span>{isPolicyDiff ? <Clock3 size={21} /> : <TriangleAlert size={21} />}</div><p>{isPolicyDiff ? <>“Corrections to submitted timesheets and salary adjustments can be processed up until <del>cutoff day 15</del> of the current pay cycle without senior director sign-off.”</> : <>“{comparison.claim}”</>}</p><button className="reference-link" onClick={() => inspect(comparison)}><Link2 size={17} />{comparison.reference}</button></article>
    <article className="claim current"><div className="claim-heading"><span>Current Law & Policy (2026)</span><BadgeCheck size={22} /></div><p>“Belgian statutory regulations enforce that corrections after submission require formal retroactive filing once past <mark>cutoff day 20</mark>; retroactive declarations apply.”</p><button className="reference-link" onClick={() => inspect(current)}><Link2 size={17} />{current.reference}</button></article></div>
    <div className="discrepancy"><Info size={22} /><div><strong>Discrepancy identified:</strong><p>{source.discrepancy}</p></div></div><div className="diff-footer"><span><History size={16} />Superseded on: {scenario.supersededOn}</span><span>Diff Hash: #{source.hash}</span></div>
  </section>;
}
