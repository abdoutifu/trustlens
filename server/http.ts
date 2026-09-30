import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { Session } from '../src/data/scenario';
import * as store from './store';

const sessions = new Map<string, { session: Session; expires: number }>();
const cookieName = 'trustlens_session';
function json(response: ServerResponse, value: unknown, status = 200) { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.end(JSON.stringify(value)); }
function error(response: ServerResponse, code: store.ApiError['code'], message: string, status: number) { json(response, { ok: false, error: { code, message } }, status); }
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 16384) throw new Error('Request too large'); chunks.push(buffer); }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an object');
  return parsed as Record<string, unknown>;
}
export async function apiMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();
  if (request.method !== 'GET' && request.method !== 'POST') return error(response, 'INVALID_INPUT', 'Unsupported method.', 405);
  if (request.method === 'POST') {
    const origin = request.headers.origin;
    if (request.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== request.headers.host)) return error(response, 'FORBIDDEN', 'Cross-origin actions are not allowed.', 403);
  }
  for (const [token, entry] of sessions) if (entry.expires < Date.now()) sessions.delete(token);
  const token = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const context = { session: token ? sessions.get(token)?.session ?? null : null };
  await store.requestContext.run(context, async () => {
    try {
      const input = request.method === 'POST' ? await body(request) : {};
      let result: unknown;
      const action = url.pathname.slice(5);
      if (action === 'session' && request.method === 'GET') return json(response, store.getSession());
      if (action === 'login' && request.method === 'POST') {
        const login = store.login(input.email as string, input.password as string);
        if (login.ok) {
          if (sessions.size > 1000) return error(response, 'SERVICE_ERROR', 'Too many demo sessions. Restart the demo server.', 503);
          if (token) sessions.delete(token);
          const nextToken = randomBytes(32).toString('hex');
          sessions.set(nextToken, { session: login.data, expires: Date.now() + 8 * 3600000 });
          response.setHeader('Set-Cookie', `${cookieName}=${nextToken}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${request.socket instanceof Object && 'encrypted' in request.socket && request.socket.encrypted ? '; Secure' : ''}`);
        }
        return json(response, login);
      }
      if (action === 'logout' && request.method === 'POST') { if (token) sessions.delete(token); store.logout(); response.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`); return json(response, { ok: true, data: null }); }
      if (request.method === 'GET') {
        const questionId = url.searchParams.get('questionId') ?? 'ticket-a';
        if (action === 'scenario') result = store.getScenario(questionId);
        else if (action === 'sources') result = store.getSources(questionId, url.searchParams.get('sourceId') ?? undefined);
        else if (action === 'cards') result = store.getVerifiedCards(questionId, url.searchParams.get('cardId') ?? undefined);
        else if (action === 'audit') result = store.getAuditLog(questionId);
      } else {
        if (action === 'validate') result = store.validateAnswer(input as unknown as store.ValidationInput);
        else if (action === 'escalate') result = store.escalate(input.questionId as string, input.sourceId as string, input.reason as string);
        else if (action === 'resolve') result = store.resolveEscalation(input.questionId as string, input.escalationId as string, input.sourceId as string, input.reason as string);
        else if (action === 'reset') result = store.resetDemo();
        else if (action === 'issues') result = store.createIssue(input as unknown as store.CreateIssueInput);
        else if (action === 'find') result = await store.findKnowledge(input.questionId as string);
      }
      if (result === undefined) return error(response, 'NOT_FOUND', 'Unknown API endpoint.', 404);
      json(response, result);
    } catch { error(response, 'INVALID_INPUT', 'Invalid request. Send a bounded JSON object.', 400); }
  });
}
export function demoApiPlugin(): Plugin { return { name: 'trustlens-server-api', configureServer(server) { server.middlewares.use((req, res, next) => { void apiMiddleware(req, res, next).catch(() => error(res, 'SERVICE_ERROR', 'Unable to complete request.', 500)); }); }, configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void apiMiddleware(req, res, next).catch(() => error(res, 'SERVICE_ERROR', 'Unable to complete request.', 500)); }); } }; }
