import { BadgeCheck, CircleCheck, TriangleAlert } from 'lucide-react';
import type { Capabilities } from '../data/scenario';
import type { Evaluation } from '../lib/scoring';
export function RecommendationBanner({ result, capabilities, onEscalate, onValidate, escalationOpen }: { result: Evaluation; capabilities: Capabilities; onEscalate: () => void; onValidate: () => void; escalationOpen: boolean }) {
  const canValidate = capabilities.canValidate && result.canValidate && !escalationOpen;
  const canEscalate = capabilities.canEscalate && result.canEscalate && !escalationOpen;
  const citations = result.conflictCount ? result.validSources : result.top ? [result.top] : [];
  return <section className={`recommendation ${result.state === 'confident' ? '' : 'recommendation-uncertain'}`} aria-label="Recommended answer">
    <div className="recommendation-icon">{result.state === 'confident' ? <BadgeCheck size={26} /> : <TriangleAlert size={26} />}</div>
    <div className="recommendation-copy"><h3>{result.message}</h3><p>{result.top ? `Accountable owner: ${result.top.owner}` : 'No current authority available.'}{result.flags.length > 0 && ` · ${result.flags.join(' · ')}`}</p>
      {citations.map(source => <details className="recommendation-citation" key={source.id}><summary>{source.title} · {source.reference}</summary><blockquote>“{source.claim}”</blockquote></details>)}
      {escalationOpen && <p className="recommendation-next">Owner review is open. Record the applicable clause in the review panel above.</p>}
      {!capabilities.canValidate && <small>Reader · You can inspect evidence and reuse verified answers. A Reviewer or Admin handles validation and owner review.</small>}
    </div>
    {(canValidate || canEscalate) && <div className="recommendation-actions">{canValidate ? <><button className="button button-primary" onClick={onValidate}><CircleCheck size={19} />Validate this answer</button>{canEscalate && <button className="text-action" onClick={onEscalate}>Escalate to owner</button>}</> : canEscalate && <button className="button button-primary" onClick={onEscalate}>Escalate to owner</button>}</div>}
  </section>;
}
