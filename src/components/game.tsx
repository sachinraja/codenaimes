'use client';

import { useEffect, useState } from 'react';
import { Board } from './board';
import { type GameState, generateRandomBoard, getGameState } from '@/lib/board';
import type { GameWord } from '@/lib/word';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  const [highlightedWords, setHighlightedWords] = useState<number[]>([]);
  const [gameState, setGameState] = useState<GameState>('playing');

  useEffect(() => {
    setBoard(generateRandomBoard());
  }, []);

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    const { words } = await generateClue(board, {
      word,
      length: clueLength,
    });

    setBoard((board) => {
      const newBoard = [...board];

      const guessedWords: number[] = [];
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

      setHighlightedWords(guessedWords);

      return newBoard;
    });

    setWord('');
    setCurrentTeam(currentTeam === 'red' ? 'blue' : 'red');
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center">
        {gameState === 'playing' ? (
          <div
            className={cn({
              'text-red-500': currentTeam === 'red',
              'text-blue-500': currentTeam === 'blue',
              'font-semibold': true,
            })}
          >
            {currentTeam}'s turn
          </div>
        ) : (
          <div
            className={cn({
              'text-red-500': gameState === 'red won',
              'text-blue-500': gameState === 'blue won',
              'font-semibold': true,
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
        />
        <Input
          type="number"
          value={clueLength}
          onChange={(e) => setClueLength(Number(e.target.value))}
          min={1}
          max={9}
          className="w-20"
          disabled={gameState !== 'playing'}
        />
        <Button disabled={gameState !== 'playing'} type="submit">
          Submit
        </Button>
      </form>

      <Board
        board={board}
        setBoard={setBoard}
        highlightedWords={highlightedWords}
      />
    </div>
  );
}

export default Game;
