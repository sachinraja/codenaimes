import type { GameWord } from './word';
import words from './words.json';

export function generateRandomBoard() {
  const randomWords = shuffle(words).slice(0, 25);

  return shuffle(
    fillGameBoardWithWords(randomWords, {
      // add up to 25
      red: 9,
      blue: 8,
      neutral: 7,
      assassin: 1,
    }),
  );
}

function fillGameBoardWithWords(
  words: string[],
  lengths: Record<GameWord['type'], number>,
) {
  const board: GameWord[] = [];

  let i = 0;
  for (const [type, length] of Object.entries(lengths)) {
    const curI = i;

    for (; i < curI + length; i++) {
      board.push({
        word: words[i],
        type: type as GameWord['type'],
        revealed: false,
      });
    }
  }

  return board;
}

function shuffle<T>(array: T[]) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

export type GameState = 'playing' | 'red won' | 'blue won';

export function getGameState(
  board: GameWord[],
  lastGuessedTeam: 'red' | 'blue',
): GameState {
  const otherTeam = lastGuessedTeam === 'red' ? 'blue' : 'red';

  const assassinWord = board.find((word) => word.type === 'assassin');
  if (!assassinWord) return `${otherTeam} won`;

  const redWords = board.filter((word) => word.type === 'red');
  const blueWords = board.filter((word) => word.type === 'blue');

  if (redWords.every((word) => word.revealed)) return 'red won';
  if (blueWords.every((word) => word.revealed)) return 'blue won';

  return 'playing';
}
