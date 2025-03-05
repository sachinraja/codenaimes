import { cn } from '@/lib/utils';
import { type ClientWord, type GameWord, typeToColor } from '@/lib/word';

interface CardProps {
  gameWord: GameWord;
  visibleState: ClientWord['visibleState'];
}

export function Card({ gameWord, visibleState }: CardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl sm:rounded-2xl font-medium text-white min-h-[48px] sm:min-h-[60px] md:min-h-[75px] p-1 sm:p-2 transition-all duration-750 text-xs sm:text-sm md:text-base text-center break-words',
        {
          [typeToColor[gameWord.type].hidden]:
            visibleState === 'hidden' || visibleState === 'selecting',
          [typeToColor[gameWord.type].revealed]: visibleState === 'revealed',
          'scale-110': visibleState === 'selecting',
        },
      )}
    >
      {gameWord.word}
    </div>
  );
}
