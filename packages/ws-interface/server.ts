import type { BaseMessage } from './base';
import type { Clue } from '@codenaimes/game/types';

interface StartGameMessage extends BaseMessage {
  type: 'start-game';
}

interface ClueMessage extends BaseMessage {
  type: 'clue';
  clue: Clue;
}

interface ServerSyncMessage extends BaseMessage {
  type: 'sync';
}

export type ServerMessage = StartGameMessage | ClueMessage | ServerSyncMessage;
