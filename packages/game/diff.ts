import type { Board, GameState } from './types';

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

export function applySelectionDiff(board: Board, diff: SelectionDiff) {
  board[diff.index] = {
    ...board[diff.index],
    revealed: true,
    reason: diff.reason,
  };
}
