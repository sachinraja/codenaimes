export const teams = ['red', 'blue'] as const;
export type Team = (typeof teams)[number];

interface BaseGameState {
  stage: string;
}

export interface LobbyGameState extends BaseGameState {
  stage: 'lobby';
}

export interface PlayingGameState extends BaseGameState {
  stage: 'playing';
  board: GameWord[];
  currentTeam: Team;
  clues: Clue[];
}

export interface CompleteGameState extends BaseGameState {
  stage: 'complete';
  board: GameWord[];
  winner: Team;
  clues: Clue[];
}

export type GameState = LobbyGameState | PlayingGameState | CompleteGameState;

export type GameStage = GameState['stage'];

export type GameWord = {
  word: string;
  type: Team | 'neutral' | 'assassin';
} & (
  | {
      revealed: true;
      reason: string;
    }
  | {
      revealed: false;
    }
);

export type Board = GameWord[];

export interface Clue {
  word: string;
  count: number;
  guesserId: string;
  team: string;
}

export interface BaseUserState {
  id: string;
  username: string;
  team: Team;
}

export interface UserState {
  id: string;
  username: string;
  team: Team;
  status: 'connected' | 'disconnected';
}
