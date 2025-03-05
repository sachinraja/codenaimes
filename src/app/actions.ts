'use server';

import { createDataStream, generateObject, streamObject } from 'ai';
import { google } from '@ai-sdk/google';
import type { Clue, GameWord } from '@/lib/word';
import { z } from 'zod';
import { getGameState } from '@/lib/board';
import type { Diff } from '@/lib/diff';
import { createStreamableValue } from 'ai/rsc';

export async function generateClue(
  board: GameWord[],
  currentTeam: 'red' | 'blue',
  clue: Clue,
) {
  const wordList = board
    .filter(({ revealed }) => !revealed)
    .map(({ word }) => word);

  const streamableDiff = createStreamableValue<Diff>();
  const { elementStream } = streamObject({
    model: google('gemini-1.5-flash'),
    output: 'array',
    schema: z.object({
      word: z.enum(wordList as [string, ...string[]]),
      reason: z.string(),
    }),
    prompt: `Pick ${clue.count} words that most closely relate to the clue from the the following list of words and rank them in order of relevance. Provide a reason explaining your logic for each word:\nClue: ${clue.word}\nList:\n${wordList.join('\n')}`,
  });

  (async () => {
    for await (const { word, reason } of elementStream) {
      const index = board.findIndex((w) => w.word === word);

      if (index === -1) {
        console.error('Word not found in board', word);
        continue;
      }

      streamableDiff.update({
        type: 'selection',
        index,
        reason: reason,
      });

      const gameState = getGameState(board, currentTeam);
      if (gameState !== 'playing') {
        streamableDiff.update({
          type: 'state',
          newState: gameState,
        });
        break;
      }
      if (board[index].type !== currentTeam) break;
    }

    streamableDiff.done();
  })();

  return streamableDiff.value;
}
