'use server';

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import type { Clue, GameWord } from '@/lib/word';
import { z } from 'zod';

export async function generateClue(board: GameWord[], clue: Clue) {
  const wordList = board
    .filter(({ revealed }) => !revealed)
    .map(({ word }) => word)
    .join('\n');

  const { object } = await generateObject({
    model: google('gemini-1.5-flash'),
    schema: z.object({
      words: z.array(z.string()).length(clue.length),
    }),
    prompt: `Pick ${clue.length} words that most closely relate to the clue from the the following list of words and rank them in order of relevance:\nClue: ${clue.word}\nList:\n${wordList}`,
  });

  return object;
}
