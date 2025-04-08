import type { UserState, GameState } from '@codenaimes/game/types';
import type { BaseMessage } from './base';
import type { Diff } from './diff';

export interface ClientSyncMessage extends BaseMessage {
  type: 'sync';
  gameState: GameState;
  userState: UserState;
  users: UserState[];
}

export interface ClientDiffMessage extends BaseMessage {
  type: 'diff';
  diffs: Diff[];
}

export interface ClientPlayerStateChangeMessage extends BaseMessage {
  type: 'player-state-change';
  userState: UserState;
}

export type ClientMessage =
  | ClientSyncMessage
  | ClientDiffMessage
  | ClientPlayerStateChangeMessage;
