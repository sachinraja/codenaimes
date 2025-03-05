import type { GameState } from './board';
import type { GameWord } from './word';

export interface BaseDiff {
  type: 'selection' | 'state';
}

export interface SelectionDiff extends BaseDiff {
  type: 'selection';
  index: number;
  reason: string;
}

export interface StateDiff extends BaseDiff {
  type: 'state';
  newState: GameState;
}

export type Diff = SelectionDiff | StateDiff;

export function applySelectionDiff(board: GameWord[], diff: SelectionDiff) {
  board[diff.index] = {
    ...board[diff.index],
    revealed: true,
    reason: diff.reason,
  };
}
