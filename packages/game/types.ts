export type Team = 'red' | 'blue';

export type GameState =
  | {
      stage: 'lobby';
      teamStateMap: Record<Team, 'waiting' | 'ready'>;
    }
  | {
      stage: 'playing';
      board: Board;
      currentTeam: Team;
    }
  | {
      stage: 'complete';
      board: Board;
      winner: Team;
    };

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
