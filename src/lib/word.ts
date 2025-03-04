export interface GameWord {
  word: string;
  type: 'red' | 'blue' | 'neutral' | 'assassin';
  revealed: boolean;
}

export interface Clue {
  word: string;
  length: number;
}
export const typeToColor: Record<
  GameWord['type'],
  { hidden: string; revealed: string }
> = {
  red: { hidden: 'bg-red-500/60', revealed: 'bg-red-500' },
  blue: { hidden: 'bg-blue-500/60', revealed: 'bg-blue-500' },
  neutral: { hidden: 'bg-neutral-500/60', revealed: 'bg-neutral-500' },
  assassin: { hidden: 'bg-purple-500/60', revealed: 'bg-purple-500' },
};
