import type { StateManager } from '@do-utils/state-manager';
import type { UserSessionMap } from './utils/user';
import type { GameState } from '@codenaimes/game/types';

export type GameStateManager = StateManager<{
  userSessions: UserSessionMap;
  gameState: GameState;
  created: boolean;
}>;
