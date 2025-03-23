import { cn } from '@/lib/utils';
import { type ClientWord, typeToColor } from '@/lib/word';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { GameWord } from '@codenaimes/game/types';

interface CardProps {
  gameWord: GameWord;
  clientWord: ClientWord;
}

export function Card({ gameWord, clientWord }: CardProps) {
  const { visibleState } = clientWord;

  return (
    <TooltipProvider>
      <Tooltip disableHoverableContent>
        <TooltipTrigger disabled={visibleState !== 'revealed'} asChild>
          <div
            className={cn(
              'flex items-center justify-center rounded-xl sm:rounded-2xl font-medium text-white min-h-[48px] sm:min-h-[60px] md:min-h-[75px] p-1 sm:p-2 transition-all duration-750 text-xs sm:text-sm md:text-base text-center break-words',
              {
                [typeToColor[gameWord.type].hidden]:
                  visibleState === 'hidden' || visibleState === 'selecting',
                [typeToColor[gameWord.type].revealed]:
                  visibleState === 'revealed',
                'scale-110': visibleState === 'selecting',
              },
            )}
          >
            {visibleState !== 'revealed' && gameWord.word}
          </div>
        </TooltipTrigger>
        {clientWord.visibleState === 'revealed' && gameWord.revealed && (
          <TooltipContent>
            <div className="flex flex-col gap-1 max-w-[200px] p-2">
              <p className="font-semibold">{gameWord.word}</p>
              <p className="text-white/80">{gameWord.reason}</p>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
