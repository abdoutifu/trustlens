import { Calculator } from 'lucide-react';
import type { Source } from '../data/scenario';
import { effectiveFactors, factorKeys, factorLabels, score, weights } from '../lib/scoring';
export function TrustBreakdown({ source }: { source: Source }) {
  const factors = effectiveFactors(source);
  return <section className="trust-panel panel" aria-label={`Trust breakdown for ${source.title}`}>{factorKeys.map(key => <div className="factor" key={key}><div className="factor-label"><strong>{factorLabels[key]}</strong><span>{Math.round(weights[key] * 100)}%</span></div><div role="progressbar" aria-label={`${factorLabels[key]} factor score`} aria-valuenow={factors[key]} aria-valuemin={0} aria-valuemax={100} className="factor-track"><div style={{ width: `${factors[key]}%` }} /></div><p>{source.reasons[key]}</p></div>)}
    <div className="formula"><p className="eyebrow"><Calculator size={17} />Weighted score formula</p><p>(0.35 × Context) + (0.30 × Authority) + (0.20 × Freshness) + (0.15 × Corrob) =</p><strong>{score(source)} / 100</strong><details><summary>Show calculation</summary><p>{factorKeys.map(key => `${weights[key].toFixed(2)} × ${factors[key]}`).join(' + ')} = {score(source)}</p></details></div>
  </section>;
}
