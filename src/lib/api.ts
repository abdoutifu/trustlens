import type { AuditEntry, Escalation, Session, Source, VerifiedCard } from '../data/scenario';
import type { ApiError, Result, ValidationInput, DecisionSnapshot, CreateIssueInput, SearchState } from '../../server/store';
export type { ApiError, Result, ValidationInput, DecisionSnapshot, CreateIssueInput, SearchState };
async function request<T>(path: string, input?: unknown): Promise<Result<T>> {
  try {
    const response = await fetch(`/api/${path}`, { method: input === undefined ? 'GET' : 'POST', credentials: 'same-origin', ...(input === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) });
    return await response.json() as Result<T>;
  } catch { return { ok: false, error: { code: 'SERVICE_ERROR', message: 'The local server is unavailable. Please retry.' } }; }
}
function params(questionId: string, name?: string, id?: string) { const query = new URLSearchParams({ questionId }); if (name && id !== undefined) query.set(name, id); return query.toString(); }
export const login = (email: string, password: string) => request<Session>('login', { email, password });
export async function logout() { await request<null>('logout', {}); }
export async function getSession(): Promise<Session | null> { try { const response = await fetch('/api/session', { credentials: 'same-origin' }); return response.ok ? await response.json() as Session | null : null; } catch { return null; } }
export const getScenario = (questionId = 'ticket-a') => request<DecisionSnapshot>(`scenario?${params(questionId)}`);
export const getSources = (questionId: string, sourceId?: string) => request<Source[]>(`sources?${params(questionId, 'sourceId', sourceId)}`);
export const getVerifiedCards = (questionId: string, cardId?: string) => request<VerifiedCard[]>(`cards?${params(questionId, 'cardId', cardId)}`);
export const getAuditLog = (questionId: string) => request<AuditEntry[]>(`audit?${params(questionId)}`);
export const validateAnswer = (input: ValidationInput) => request<VerifiedCard>('validate', input);
export const escalate = (questionId: string, sourceId: string, reason: string) => request<Escalation>('escalate', { questionId, sourceId, reason });
export const resolveEscalation = (questionId: string, escalationId: string, sourceId: string, reason: string) => request<Escalation>('resolve', { questionId, escalationId, sourceId, reason });
export const resetDemo = () => request<null>('reset', {});
export const createIssue = (input: CreateIssueInput) => request<DecisionSnapshot>('issues', input);
export const findKnowledge = (questionId: string) => request<DecisionSnapshot>('find', { questionId });
