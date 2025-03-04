'use client';

import { useEffect, useState } from 'react';
import { Board } from './board';
import { type GameState, generateRandomBoard, getGameState } from '@/lib/board';
import type { GameWord } from '@/lib/word';
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

const loadingBoard: GameWord[] = Array.from({ length: 25 }, () => ({
  word: '',
  type: 'neutral',
  revealed: false,
}));

function Game() {
  const [board, setBoard] = useState(loadingBoard);
  const [word, setWord] = useState('');
  const [clueLength, setClueLength] = useState(1);
  const [currentTeam, setCurrentTeam] = useState<'red' | 'blue'>('red');
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [guessingWords, setGuessingWords] = useState<number[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [gameState, setGameState] = useState<GameState>('playing');

  useEffect(() => {
    setBoard(generateRandomBoard());
  }, []);

  const animateGuessedWords = async (guessedWords: number[]) => {
    setGuessingWords(guessedWords);
    setIsSelecting(true);

    for (let i = 0; i < guessedWords.length; i++) {
      setSelectedWords((prev) => [...prev, guessedWords[i]]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setSelectedWords([]);
    setIsSelecting(false);
    setGuessingWords([]);
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    const { words } = await generateClue(board, {
      word,
      length: clueLength,
    });

    const guessedWords: number[] = [];

    setBoard((board) => {
      const newBoard = [...board];
      let i = 0;
      for (; i < words.length; i++) {
        const index = board.findIndex((w) => w.word === words[i]);
        if (index === -1) continue;

        board[index].revealed = true;
        guessedWords.push(index);

        const gameState = getGameState(board, currentTeam);

        if (gameState !== 'playing') {
          setGameState(gameState);
          break;
        }
        if (board[index].type !== currentTeam) break;
      }
      return newBoard;
    });

    setWord('');
    setCurrentTeam(currentTeam === 'red' ? 'blue' : 'red');

    await animateGuessedWords(guessedWords);
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
            value={clueLength.toString()}
            onValueChange={(value) => setClueLength(Number(value))}
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

      <Board
        board={board}
        setBoard={setBoard}
        selectedWords={selectedWords}
        guessingWords={guessingWords}
      />
    </div>
  );
}

export default Game;
