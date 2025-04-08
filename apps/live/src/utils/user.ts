import { parse } from 'cookie';

export function getSessionId(request: Request) {
  const cookie = parse(request.headers.get('Cookie') ?? '');
  const sessionId = cookie.sessionId;
  if (!sessionId) return null;
  return sessionId;
}
