import { cn } from '@/lib/utils';
import { type GameWord, typeToColor } from '@/lib/word';

interface CardProps {
  gameWord: GameWord;
  isSelected?: boolean;
  isGuessing?: boolean;
}

export function Card({ gameWord, isSelected, isGuessing }: CardProps) {
  const isGuessedButNotSelected = isGuessing && !isSelected;
  const isVisible = gameWord.revealed && !isGuessedButNotSelected;

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl sm:rounded-2xl font-medium text-white min-h-[48px] sm:min-h-[60px] md:min-h-[75px] p-1 sm:p-2 transition-all duration-500 text-xs sm:text-sm md:text-base text-center break-words',
        {
          [typeToColor[gameWord.type].hidden]:
            !gameWord.revealed || isGuessedButNotSelected,
          [typeToColor[gameWord.type].revealed]: isVisible,
          'text-white/60': isVisible,
          'scale-110': isSelected,
        },
      )}
    >
      {gameWord.word}
    </div>
  );
}
