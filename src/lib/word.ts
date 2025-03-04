export interface GameWord {
  word: string;
  type: 'red' | 'blue' | 'neutral' | 'assassin';
  revealed: boolean;
}

export interface Clue {
  word: string;
  length: number;
}
