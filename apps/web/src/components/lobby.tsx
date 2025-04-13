'use client';

import { cn, getUserClassNames } from '@/lib/utils';
import { Button } from './ui/button';
import { teams, type UserState, type Team } from '@codenaimes/game/types';
import { CheckIcon, ClockIcon } from 'lucide-react';
import { canGameStart } from '@codenaimes/game/utils';
import { PlayerAvatar } from './player-avatar';

export interface LobbyProps {
  startGame: () => void;
  switchTeam: () => void;
  users: UserState[];
}

export function Lobby({ startGame, users, switchTeam }: LobbyProps) {
  return (
    <div className="flex flex-col items-center justify-center m-8 space-y-4">
      <h1 className="text-lg font-bold">lobby</h1>

      <div className="flex flex-row space-x-4">
        <Button
          className="cursor-pointer"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.href}/join`);
          }}
        >
          copy join link
        </Button>
        <Button className="cursor-pointer" onClick={switchTeam}>
          switch teams
        </Button>
        <Button
          className="cursor-pointer"
          disabled={!canGameStart(users)}
          onClick={startGame}
        >
          start game
        </Button>
      </div>

      <ul className="flex grid-cols-4 gap-2">
        {users.map((user) => (
          <li
            key={user.id}
            className={cn(
              'flex flex-row items-center space-x-2 p-2 rounded text-lg',
              getUserClassNames(user),
            )}
          >
            <PlayerAvatar username={user.username} size={24} />
            <span>{user.username}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
