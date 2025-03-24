'use client';

import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import type { Team } from '@codenaimes/game/types';
import { CheckIcon, ClockIcon } from 'lucide-react';

type TeamState = 'waiting' | 'ready';

export interface LobbyProps {
  teamStateMap: Record<Team, TeamState>;
  startGame: () => void;
}

function TeamCard({ team, state }: { team: Team; state: TeamState }) {
  return (
    <div
      className={cn(
        'flex flex-row items-center justify-center space-x-4 m-4 p-4 rounded-lg text-white',
        `bg-${team}-500`,
      )}
    >
      <h1 className="text-lg font-bold">{team}</h1>

      {state === 'ready' ? <CheckIcon /> : <ClockIcon />}
    </div>
  );
}

export function Lobby({ teamStateMap, startGame }: LobbyProps) {
  return (
    <div className="flex flex-col items-center justify-center m-8">
      <h1 className="text-lg font-bold mb-4">lobby</h1>

      <div className="flex flex-row space-x-4">
        <Button
          className="cursor-pointer"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
          }}
        >
          copy room link
        </Button>
        <Button
          className="cursor-pointer"
          disabled={Object.values(teamStateMap).some(
            (state) => state === 'waiting',
          )}
          onClick={startGame}
        >
          start game
        </Button>
      </div>

      <div className="w-1/2">
        <div className="flex flex-row justify-center items-center">
          {Object.entries(teamStateMap).map(([team, state]) => (
            <TeamCard key={team} team={team as Team} state={state} />
          ))}
        </div>
      </div>
    </div>
  );
}
