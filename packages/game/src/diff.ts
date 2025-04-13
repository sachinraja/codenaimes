import type { GameState } from './types';

interface BaseDiff {
  type: string;
}

export interface SelectionDiff extends BaseDiff {
  type: 'selection';
  index: number;
}

export interface StateDiff extends BaseDiff {
  type: 'state';
  state: GameState;
}

export type Diff = SelectionDiff | StateDiff;
