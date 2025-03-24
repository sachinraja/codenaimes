import type { GameState, UserState } from '@codenaimes/game/types';
import type { BaseMessage } from './base';
import type { Diff } from './diff';

interface ClientSyncMessage extends BaseMessage {
  type: 'sync';
  gameState: GameState;
  userState: UserState;
}

interface ClientDiffMessage extends BaseMessage {
  type: 'diff';
  diffs: Diff[];
}

export type ClientMessage = ClientSyncMessage | ClientDiffMessage;
