import type { GameWord } from '@/lib/word';
import { Card } from './card';
import { cn } from '@/lib/utils';

const typeToColor: Record<
  GameWord['type'],
  { hidden: string; revealed: string }
> = {
  red: { hidden: 'bg-red-500/60', revealed: 'bg-red-500' },
  blue: { hidden: 'bg-blue-500/60', revealed: 'bg-blue-500' },
  neutral: { hidden: 'bg-neutral-500/60', revealed: 'bg-neutral-500' },
  assassin: { hidden: 'bg-purple-500/60', revealed: 'bg-purple-500' },
};

interface BoardProps {
  board: GameWord[];
  setBoard: (cb: (board: GameWord[]) => GameWord[]) => void;
}

export function Board({ board }: BoardProps) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-4">
        {board.map(({ word, type, revealed }, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: position of each card does not change
            key={i}
            className={cn({
              [typeToColor[type].hidden]: !revealed,
              [typeToColor[type].revealed]: revealed,
            })}
          >
            {word}
          </Card>
        ))}
      </div>
    </div>
  );
}
