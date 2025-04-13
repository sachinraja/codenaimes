import type { Clue, Team, UserState } from '@codenaimes/game/types';
import { PlayerAvatar } from './player-avatar';
import { cn } from '@/lib/utils';

interface ClueHistoryProps {
  clues: Clue[];
  users: UserState[];
}

function ClueCard({
  clue,
  users,
}: {
  clue: Clue;
  users: UserState[];
}) {
  const guesser = users.find((user) => user.id === clue.guesserId);

  return (
    <div className="flex space-x-2 items-center">
      {guesser && <PlayerAvatar username={guesser.username} size={20} />}
      <span>{clue.word}</span>
      <span className="font-bold">{clue.count}</span>
    </div>
  );
}

export function ClueHistory({ clues, users }: ClueHistoryProps) {
  return (
    <ul className="flex space-x-2 text-sm">
      {clues.map((clue, i) => (
        <li
          className={cn('p-1 rounded', {
            'bg-red-500/40 text-red-500': clue.team === 'red',
            'bg-blue-500/40 text-blue-500': clue.team === 'blue',
          })}
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          key={i}
        >
          <div className="flex space-x-2 items-center">
            <ClueCard clue={clue} users={users} />
          </div>
        </li>
      ))}
    </ul>
  );
}
