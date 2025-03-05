'use client';

import { useEffect, useState } from 'react';
import { Board } from './board';
import { type GameState, generateRandomBoard, getGameState } from '@/lib/board';
import type { ClientWord, GameWord } from '@/lib/word';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateClue } from '@/app/actions';
import { cn } from '@/lib/utils';
import { applySelectionDiff, type StateDiff } from '@/lib/diff';
import { readStreamableValue } from 'ai/rsc';

const loadingBoard: GameWord[] = Array.from({ length: 25 }, () => ({
  word: '',
  type: 'neutral',
  revealed: false,
}));

const baseClientBoard: ClientWord[] = Array.from({ length: 25 }, () => ({
  visibleState: 'hidden',
}));

function Game() {
  const [board, setBoard] = useState(loadingBoard);
  const [clientBoard, setClientBoard] = useState<ClientWord[]>(baseClientBoard);
  const [word, setWord] = useState('');
  const [clueCount, setClueCount] = useState(1);
  const [currentTeam, setCurrentTeam] = useState<'red' | 'blue'>('red');
  const [isSelecting, setIsSelecting] = useState(false);
  const [gameState, setGameState] = useState<GameState>('playing');

  useEffect(() => {
    setBoard(generateRandomBoard());
  }, []);

  const animateGuessedWord = async (guessedWord: number) => {
    setClientBoard((clientBoard) => {
      const newClientBoard = [...clientBoard];
      newClientBoard[guessedWord] = {
        ...newClientBoard[guessedWord],
        visibleState: 'selecting',
      };
      return newClientBoard;
    });

    await new Promise<void>((resolve) =>
      setTimeout(() => {
        setClientBoard((clientBoard) => {
          const newClientBoard = [...clientBoard];
          newClientBoard[guessedWord] = {
            ...newClientBoard[guessedWord],
            visibleState: 'revealed',
          };
          return newClientBoard;
        });
        resolve();
      }, 750),
    );
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    const diffs = await generateClue(board, currentTeam, {
      word,
      count: clueCount,
    });

    let stateDiff: StateDiff | undefined = undefined;

    const newBoard = [...board];
    for await (const diff of readStreamableValue(diffs)) {
      if (!diff) continue;
      if (diff.type === 'selection') {
        applySelectionDiff(newBoard, diff);
        await animateGuessedWord(diff.index);
      } else if (diff.type === 'state') {
        stateDiff = diff;
      }
    }

    setBoard(newBoard);
    setWord('');
    setCurrentTeam(currentTeam === 'red' ? 'blue' : 'red');

    setIsSelecting(true);
    if (stateDiff) setGameState(stateDiff.newState);
    setIsSelecting(false);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center">
        {gameState === 'playing' || isSelecting ? (
          <div
            className={cn({
              'text-red-500': currentTeam === 'red',
              'text-blue-500': currentTeam === 'blue',
              'font-semibold text-lg': true,
            })}
          >
            {currentTeam}'s turn
          </div>
        ) : (
          <div
            className={cn({
              'text-red-500': gameState === 'red won',
              'text-blue-500': gameState === 'blue won',
              'font-semibold text-lg': true,
            })}
          >
            {gameState}
          </div>
        )}
      </div>
      <form onSubmit={handleWordSubmit} className="flex gap-2">
        <Input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a clue..."
          disabled={gameState !== 'playing'}
          className="flex-1"
        />
        <div className="flex gap-2">
          <Select
            value={clueCount.toString()}
            onValueChange={(value) => setClueCount(Number(value))}
            disabled={gameState !== 'playing'}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={gameState !== 'playing' || isSelecting}
            type="submit"
          >
            Submit
          </Button>
        </div>
      </form>

      <Board board={board} clientBoard={clientBoard} />
    </div>
  );
}

export default Game;
