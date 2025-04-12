import type { Clue, GameState, Team } from './types';

interface BaseDiff {
  type: string;
}

export interface ClueDiff extends BaseDiff {
  type: 'clue';
  team: Team;
  clue: Clue;
}

export interface SelectionDiff extends BaseDiff {
  type: 'selection';
  index: number;
}

export interface StateDiff extends BaseDiff {
  type: 'state';
  state: GameState;
}

export type Diff = SelectionDiff | StateDiff | ClueDiff;
