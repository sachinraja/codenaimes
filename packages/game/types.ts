export type Team = 'red' | 'blue';
export type GameState =
  | {
      state: 'playing';
      currentTeam: Team;
    }
  | {
      state: 'complete';
      winner: Team;
    };

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
