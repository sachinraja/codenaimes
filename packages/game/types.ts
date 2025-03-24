export type Team = 'red' | 'blue';

interface BaseGameState {
  stage: string;
}

export interface LobbyGameState extends BaseGameState {
  stage: 'lobby';
  teamStateMap: Record<Team, 'waiting' | 'ready'>;
}

export interface PlayingGameState extends BaseGameState {
  stage: 'playing';
  board: GameWord[];
  currentTeam: Team;
  clues: Record<Team, Clue[]>;
}

export interface CompleteGameState extends BaseGameState {
  stage: 'complete';
  board: GameWord[];
  winner: Team;
  clues: Record<Team, Clue[]>;
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
}

export interface UserState {
  id: string;
  team: Team;
}
