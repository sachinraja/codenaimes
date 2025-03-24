import type { Board, Clue, GameState, Team } from '@codenaimes/game/types';

export interface BaseMessage {
  type: string;
}

export interface StartGameMessage extends BaseMessage {
  type: 'start-game';
}

export interface ClueMessage extends BaseMessage {
  type: 'clue';
  clue: Clue;
}

export interface ServerSyncMessage extends BaseMessage {
  type: 'sync';
}

export type ServerMessage = StartGameMessage | ClueMessage | ServerSyncMessage;

export interface ChangeGameStateMessage extends BaseMessage {
  type: 'change-game-state';
  newState: GameState;
}

export interface PlayerJoinMessage extends BaseMessage {
  type: 'player-join';
  team: Team;
}

export interface ClientSyncMessage extends BaseMessage {
  type: 'sync';
  state: GameState;
}

export type ClientMessage =
  | ChangeGameStateMessage
  | PlayerJoinMessage
  | ClientSyncMessage;
