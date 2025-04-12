import type { StateManager } from '@do-utils/state-manager';
import type {
  BaseUserState,
  GameState,
  UserState,
} from '@codenaimes/game/types';

export interface ServerUserState extends BaseUserState {
  connections: number;
}

export type UserSessionMap = Map<string, ServerUserState>;

export type GameStateManager = StateManager<{
  userSessions: UserSessionMap;
  gameState: GameState;
  created: boolean;
}>;

export function serverToClientUserState(user: ServerUserState): UserState {
  return {
    id: user.id,
    username: user.username,
    team: user.team,
    status: user.connections > 0 ? 'connected' : 'disconnected',
  };
}
