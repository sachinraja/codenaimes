import { typeToColor, type GameWord } from '@/lib/word';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface BoardProps {
  board: GameWord[];
  setBoard: (cb: (board: GameWord[]) => GameWord[]) => void;
  guessingWords: number[];
  selectedWords: number[];
}

export function Board({
  board,
  guessingWords: guessedWords,
  selectedWords,
}: BoardProps) {
  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-4 min-w-[300px]">
        {board.map((gameWord, i) => {
          const isSelected = selectedWords.includes(i);
          const isGuessedButNotSelected =
            !isSelected && guessedWords.includes(i);
          return (
            <Card
              // biome-ignore lint/suspicious/noArrayIndexKey: position of each card does not change
              key={i}
              gameWord={gameWord}
              isSelected={isSelected}
              isGuessing={isGuessedButNotSelected}
            />
          );
        })}
      </div>
    </div>
  );
}
