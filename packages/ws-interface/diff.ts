import type { GameState } from '@codenaimes/game/types';

interface BaseDiff {
  type: 'selection' | 'state';
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
