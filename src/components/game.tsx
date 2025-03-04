'use client';

import { useEffect, useState } from 'react';
import { Board } from './board';
import { generateRandomBoard } from '@/lib/board';
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
  const [guessedWords, setGuessedWords] = useState<string[]>([]);
  const [lastGuessedWordIndex, setLastGuessedWordIndex] = useState(0);

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

    setGuessedWords(words);

    setBoard((board) => {
      const newBoard = [...board];

      let i = 0;
      for (; i < words.length; i++) {
        const index = board.findIndex((w) => w.word === words[i]);
        if (index !== -1) newBoard[index].revealed = true;
        if (newBoard[index].type !== currentTeam) break;
      }

      setLastGuessedWordIndex(i);
      return newBoard;
    });

    setWord('');
    setCurrentTeam(currentTeam === 'red' ? 'blue' : 'red');
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div
            className={cn({
              'text-red-500': currentTeam === 'red',
              'text-blue-500': currentTeam === 'blue',
              'font-semibold': true,
            })}
          >
            {currentTeam}'s turn
          </div>
        </div>
      </div>
      <form onSubmit={handleWordSubmit} className="flex gap-2">
        <Input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a clue..."
        />
        <Input
          type="number"
          value={clueLength}
          onChange={(e) => setClueLength(Number(e.target.value))}
          min={1}
          max={9}
          className="w-20"
        />
        <Button type="submit">Submit</Button>
      </form>
      <div className="grid grid-cols-5 gap-2">
        {guessedWords.map((word, i) => (
          <div
            key={word}
            className={cn(
              'flex text-white p-2 rounded-md items-center justify-center',
              {
                'bg-green-500': i < lastGuessedWordIndex,
                'bg-red-500': i === lastGuessedWordIndex,
                'bg-gray-600': i > lastGuessedWordIndex,
              },
            )}
          >
            {word}
          </div>
        ))}
      </div>
      <Board board={board} setBoard={setBoard} />
    </div>
  );
}

export default Game;
