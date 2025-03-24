import { cn } from '@/lib/utils';
import type { Clue, Team } from '@codenaimes/game/types';

interface TeamDisplayProps {
  team: Team;
  bgColor: string;
  textColor: string;
  clues: Clue[];
}

export function TeamDisplay({
  team,
  bgColor,
  textColor,
  clues,
}: TeamDisplayProps) {
  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-w-0 items-center rounded p-4 space-y-2',
        bgColor,
      )}
    >
      <h2 className={cn('font-semibold', textColor)}>{team}</h2>
      {/* list clues */}
      <ul className="space-y-2">
        {clues.map((clue, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <li className="border border-black p-2 rounded" key={i}>
            {clue.word} ({clue.count})
          </li>
        ))}
      </ul>
    </div>
  );
}
