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
