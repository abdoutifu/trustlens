import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, FilePlus2, X } from 'lucide-react';
import type { ApiError } from '../lib/api';

export interface NewIssueInput {
  question: string;
  countryCode: string;
  customer: string;
  year: number;
}

export function NewIssueModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (input: NewIssueInput) => Promise<ApiError | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    element.querySelector<HTMLTextAreaElement>('textarea[name="question"]')?.focus();
    return () => { element.close(); previous?.focus(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      setError(await onSubmit({
        question: String(data.get('question') ?? '').trim(),
        countryCode: String(data.get('countryCode') ?? ''),
        customer: String(data.get('customer') ?? '').trim(),
        year: Number(data.get('year')),
      }));
    } catch {
      setError({ code: 'INVALID_INPUT', message: 'The issue could not be created. Please try again.' });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <dialog ref={dialog} className="validate-modal new-issue-modal" aria-labelledby="new-issue-heading" onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <div className="modal-heading"><div><span className="eyebrow">Start a knowledge review</span><h2 id="new-issue-heading">New issue</h2></div><button type="button" className="icon-button" aria-label="Close new issue" disabled={pending} onClick={onClose}><X /></button></div>
    <p className="modal-intro">Ask a specific payroll question, set its context, and find relevant source clauses.</p>
    <ol className="issue-flow" aria-label="Issue review workflow">{['Create issue', 'Find', 'Understand', 'Trust', 'Validate / escalate', 'Reuse'].map((step, index) => <li key={step}><span>{step}</span>{index < 5 && <ArrowRight size={13} aria-hidden="true" />}</li>)}</ol>
    <form onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="issue-fields">
        <label>Question<textarea name="question" required minLength={10} maxLength={1000} rows={3} autoFocus placeholder="What does this customer need to know?" aria-invalid={error?.field === 'question'} aria-describedby={error?.field === 'question' ? 'issue-error' : undefined} /></label>
        <div className="form-row"><label>Country<select name="countryCode" defaultValue="BE" required aria-invalid={error?.field === 'countryCode'}><option value="BE">Belgium</option><option value="FR">France</option></select></label><label>Payroll year<input name="year" type="number" defaultValue={2026} min={2020} max={2030} required aria-invalid={error?.field === 'year'} /></label></div>
        <label>Customer<input name="customer" defaultValue="Acme NV" required maxLength={100} aria-invalid={error?.field === 'customer'} /></label>
      </fieldset>
      <p className="issue-disclosure">When AI assistance is enabled, your question and relevant source excerpts may be sent to OpenAI. Only include information you are permitted to share.</p>
      {error && <p id="issue-error" className="form-error" role="alert">{error.message}</p>}
      <div className="modal-actions"><button className="button button-secondary" type="button" disabled={pending} onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={pending}><FilePlus2 size={17} />{pending ? 'Creating and finding…' : 'Create & find evidence'}</button></div>
    </form>
  </dialog>;
}
