import type { BaseUserState, UserState } from '@codenaimes/game/types';
import { parse } from 'cookie';

export interface ServerUserState extends BaseUserState {
  connections: number;
}

export type UserSessionMap = Map<string, ServerUserState>;

export function getSessionId(request: Request) {
  const cookie = parse(request.headers.get('Cookie') ?? '');
  const sessionId = cookie.sessionId;
  if (!sessionId) return null;
  return sessionId;
}

export function serverToClientUserState(user: ServerUserState): UserState {
  return {
    id: user.id,
    username: user.username,
    team: user.team,
    status: user.connections > 0 ? 'connected' : 'disconnected',
  };
}
