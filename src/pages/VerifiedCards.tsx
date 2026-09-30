import { ArrowRight, BadgeCheck, CalendarDays, Clock3, TriangleAlert } from 'lucide-react';
import type { VerifiedCard } from '../data/scenario';
import { cardStatus } from '../lib/scoring';
export function VerifiedCards({ cards, onDecision, onReuse }: { cards: VerifiedCard[]; onDecision: () => void; onReuse?: (card: VerifiedCard) => void }) {
  return <section className="page-section"><div className="page-heading"><div><p className="eyebrow">Reviewed knowledge</p><h1>Verified cards</h1><p>Reuse a reviewed answer in its original question and context.</p></div><span className="count-chip">{cards.length} verified</span></div>
    {cards.length === 0 ? <div className="empty-state panel"><BadgeCheck size={40} /><h2>No verified answers yet</h2><p>Open an issue, inspect its evidence, then validate the applicable clause. Your reviewed answer will appear here for reuse.</p><button className="button button-primary" onClick={onDecision}>Open a decision<ArrowRight size={17} /></button></div> : <div className="verified-grid">{[...cards].sort((a, b) => Number(cardStatus(a.reviewBy) === 'expired') - Number(cardStatus(b.reviewBy) === 'expired') || b.createdAt.localeCompare(a.createdAt)).map(card => {
      const status = cardStatus(card.reviewBy);
      const Icon = status === 'valid' ? BadgeCheck : status === 'expired' ? TriangleAlert : Clock3;
      return <article className="verified-card panel" key={card.id}>
        <span className={`lifecycle ${status === 'valid' ? 'green' : status === 'expired' ? 'red' : 'amber'}`}><Icon size={16} />{status === 'expired' ? 'Expired · Needs re-verification' : status === 'expiring soon' ? 'Expiring soon' : 'Valid · Ready to reuse'}</span>
        <h2>{card.title}</h2><p className="verified-claim">{card.claim}</p>
        <dl className="verified-summary"><dt>Accountable owner</dt><dd>{card.owner}</dd><dt>Review by</dt><dd><CalendarDays size={15} />{card.reviewBy}</dd></dl>
        <details className="verified-evidence"><summary>Source citation and review record</summary><dl><dt>Source citation</dt><dd>{card.citation?.reference ?? card.sourceId}</dd>{card.citation?.quote && <><dt>Exact source clause</dt><dd>“{card.citation.quote}”</dd></>}<dt>Reason</dt><dd>{card.reason}</dd><dt>Verified by</dt><dd>{card.verifiedBy}</dd></dl></details>
        <div className="verified-footer"><p>{status === 'expired' ? 'Retained for history; excluded as current authority.' : 'Available as reviewed authority in this decision.'}</p><button className={`button ${status === 'expired' ? 'button-secondary' : 'button-primary'}`} onClick={() => onReuse ? onReuse(card) : onDecision()}>{status === 'expired' ? 'Review this decision' : 'Reuse in decision'}<ArrowRight size={16} /></button></div>
      </article>;
    })}</div>}
  </section>;
}
