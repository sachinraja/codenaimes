import { typeToColor, type GameWord } from '@/lib/word';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface BoardProps {
  board: GameWord[];
  setBoard: (cb: (board: GameWord[]) => GameWord[]) => void;
  highlightedWords: number[];
}

export function Board({ board, highlightedWords }: BoardProps) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-4">
        {board.map((gameWord, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: position of each card does not change
            key={i}
            className={cn('border-4', {
              [typeToColor[gameWord.type].hidden]: !gameWord.revealed,
              [typeToColor[gameWord.type].revealed]: gameWord.revealed,
              'border-yellow-500': highlightedWords.includes(i),
            })}
          >
            {gameWord.word}
          </Card>
        ))}
      </div>
    </div>
  );
}
