'use client';

import { useEffect, useState } from 'react';
import { Board } from './board';
import type { ClientWord } from '@/lib/word';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  Clue,
  CompleteGameState,
  PlayingGameState,
  Team,
  UserState,
} from '@codenaimes/game/types';
import type { Diff, StateDiff } from '@codenaimes/ws-interface/diff';

type GameProps = {
  userState: UserState;
  gameState: PlayingGameState | CompleteGameState;
  submitClue: (clue: Clue) => void;
  diffs: Diff[];
};

function Game({ userState, gameState, submitClue, diffs }: GameProps) {
  const [clientBoard, setClientBoard] = useState<ClientWord[]>(
    gameState.board.map((word) => ({
      visibleState: word.revealed ? 'revealed' : 'hidden',
    })),
  );
  const [word, setWord] = useState('');
  const [clueCount, setClueCount] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team>(
    gameState.stage === 'playing' ? gameState.currentTeam : gameState.winner,
  );

  useEffect(() => {
    const guessedWords: number[] = [];

    let stateDiff: StateDiff | undefined;
    for (const diff of diffs) {
      if (diff.type === 'selection') guessedWords.push(diff.index);
      if (diff.type === 'state') stateDiff = diff;
    }

    setWord('');

    (async () => {
      setIsSelecting(true);
      await animateGuessedWords(guessedWords);
      setIsSelecting(false);

      if (stateDiff?.state.stage === 'playing')
        setCurrentTeam(stateDiff.state.currentTeam);
    })();
  }, [diffs]);

  const animateGuessedWords = async (guessedWords: number[]) => {
    for (let i = 0; i < guessedWords.length; i++) {
      setClientBoard((clientBoard) => {
        const newClientBoard = [...clientBoard];
        newClientBoard[guessedWords[i]] = {
          ...newClientBoard[guessedWords[i]],
          visibleState: 'selecting',
        };
        return newClientBoard;
      });

      await new Promise<void>((resolve) =>
        setTimeout(() => {
          setClientBoard((clientBoard) => {
            const newClientBoard = [...clientBoard];
            newClientBoard[guessedWords[i]] = {
              ...newClientBoard[guessedWords[i]],
              visibleState: 'revealed',
            };
            return newClientBoard;
          });
          resolve();
        }, 750),
      );
    }
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    submitClue({ word, count: clueCount });
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center">
        {gameState.stage === 'playing' || isSelecting ? (
          <div className="font-semibold text-lg">
            <span
              className={cn({
                'text-red-500': currentTeam === 'red',
                'text-blue-500': currentTeam === 'blue',
              })}
            >
              {currentTeam}'s turn
            </span>{' '}
            <span>{currentTeam === userState.team && '(you)'}</span>
          </div>
        ) : (
          <div
            className={cn({
              'text-red-500': gameState.winner === 'red',
              'text-blue-500': gameState.winner === 'blue',
              'font-semibold text-lg': true,
            })}
          >
            {gameState.winner} won
          </div>
        )}
      </div>
      <form onSubmit={handleWordSubmit} className="flex gap-2">
        <Input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a clue..."
          disabled={gameState.stage !== 'playing'}
          className="flex-1"
        />
        <div className="flex gap-2">
          <Select
            value={clueCount.toString()}
            onValueChange={(value) => setClueCount(Number(value))}
            disabled={gameState.stage !== 'playing'}
          >
            <SelectTrigger className="w-24 cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                <SelectItem
                  className="cursor-pointer"
                  key={num}
                  value={num.toString()}
                >
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="cursor-pointer"
            disabled={
              gameState.stage !== 'playing' ||
              currentTeam !== userState.team ||
              isSelecting
            }
            type="submit"
          >
            Submit
          </Button>
        </div>
      </form>

      <Board board={gameState.board} clientBoard={clientBoard} />
    </div>
  );
}

export default Game;
