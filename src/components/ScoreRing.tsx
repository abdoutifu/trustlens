import { useEffect, useState } from 'react';
export function ScoreRing({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const frame = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(frame); }, [value]);
  const tone = value >= 75 ? 'green' : value >= 50 ? 'amber' : 'red';
  return <div className={`score-ring ${tone}`} role="img" aria-label={`Trust score ${value} out of 100, ${value >= 75 ? 'high' : value >= 50 ? 'moderate' : 'low'} trust`}><svg viewBox="0 0 56 56" aria-hidden="true"><circle className="ring-track" cx="28" cy="28" r="23" /><circle className="ring-value" cx="28" cy="28" r="23" pathLength="100" strokeDasharray={`${shown} 100`} transform="rotate(-90 28 28)" /></svg><strong>{Math.round(value)}</strong><small>Trust Score</small></div>;
}
