import type { Clue, Team } from '@codenaimes/game/types';

export interface BaseMessage {
  type: string;
}

export interface JoinRoomMessage extends BaseMessage {
  type: 'join-room';
  team: Team;
}

export interface StartGameMessage extends BaseMessage {
  type: 'start-game';
}

export interface ClueMessage extends BaseMessage {
  type: 'clue';
  clue: Clue;
}

export type Message = JoinRoomMessage | StartGameMessage | ClueMessage;
