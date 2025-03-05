export type GameWord = {
  word: string;
  type: 'red' | 'blue' | 'neutral' | 'assassin';
} & (
  | {
      revealed: true;
      reason: string;
    }
  | {
      revealed: false;
    }
);

export interface ClientWord {
  visibleState: 'hidden' | 'revealed' | 'selecting';
}

export interface Clue {
  word: string;
  count: number;
}

export const typeToColor: Record<
  GameWord['type'],
  { hidden: string; revealed: string }
> = {
  red: { hidden: 'bg-red-500', revealed: 'bg-red-500/40' },
  blue: { hidden: 'bg-blue-500', revealed: 'bg-blue-500/40' },
  neutral: { hidden: 'bg-neutral-500', revealed: 'bg-neutral-500/40' },
  assassin: { hidden: 'bg-purple-500', revealed: 'bg-purple-500/40' },
};
