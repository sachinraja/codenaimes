import type { ClientWord } from '@/lib/word';
import { Card } from './card';
import type { Board as BoardType } from '@codenaimes/game/types';

interface BoardProps {
  board: BoardType;
  clientBoard: ClientWord[];
}

export function Board({ board, clientBoard }: BoardProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-4 min-w-[300px]">
      {board.map((gameWord, i) => {
        return (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: position of each card does not change
            key={i}
            gameWord={gameWord}
            clientWord={clientBoard[i]}
          />
        );
      })}
    </div>
  );
}
