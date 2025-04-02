'use client';

import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { teams, type UserState, type Team } from '@codenaimes/game/types';
import { CheckIcon, ClockIcon } from 'lucide-react';
import { canGameStart } from '@/lib/game';

export interface LobbyProps {
  startGame: () => void;
  switchTeam: () => void;
  users: UserState[];
}

function TeamCard({ team, users }: { team: Team; users: UserState[] }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center space-x-4 m-4 p-4 rounded-lg text-white',
        `bg-${team}-500`,
      )}
    >
      <h1 className="text-lg font-bold">{team}</h1>

      <div>
        {users.map((user) => (
          <div key={user.id} className="flex flex-row items-center space-x-2">
            {user.status === 'connected' ? (
              <CheckIcon className="text-green-500" />
            ) : (
              <ClockIcon className="text-yellow-500" />
            )}
            <p>{user.username}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Lobby({ startGame, users, switchTeam }: LobbyProps) {
  return (
    <div className="flex flex-col items-center justify-center m-8">
      <h1 className="text-lg font-bold mb-4">lobby</h1>

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

      <div className="w-1/2">
        <div className="flex flex-row justify-center items-center">
          {teams.map((team) => (
            <TeamCard
              key={team}
              team={team}
              users={users.filter((user) => user.team === team)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
