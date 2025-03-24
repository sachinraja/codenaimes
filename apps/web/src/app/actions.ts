'use server';

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { getGameState } from '@codenaimes/game/board';
import type { Diff } from '@codenaimes/game/diff';
import type { Board, Team, Clue } from '@codenaimes/game/types';

export async function generateClue(
  board: Board,
  currentTeam: Team,
  clue: Clue,
) {
  const wordList = board
    .filter(({ revealed }) => !revealed)
    .map(({ word }) => word);

  const { object: words } = await generateObject({
    model: google('gemini-1.5-flash'),
    schema: z
      .object({
        word: z.enum(wordList as [string, ...string[]]),
        reason: z.string(),
      })
      .array()
      .length(clue.count),
    prompt: `Pick ${clue.count} word${clue.count === 1 ? '' : 's'} that most closely relate${clue.count === 1 ? 's' : ''} to the clue from the the following list of words and rank them in order of relevance. Provide a short reason explaining your logic ${
      clue.count === 1 ? 'for the word' : 'for each word'
    }:\nClue: ${clue.word}\nList:\n${wordList.join('\n')}`,
  });

  const diffs: Diff[] = [];
  let i = 0;
  for (; i < words.length; i++) {
    const index = board.findIndex((w) => w.word === words[i].word);
    if (index === -1) {
      console.error('Word not found in board', words[i].word);
      continue;
    }

    board[index] = {
      ...board[index],
      revealed: true,
      reason: words[i].reason,
    };

    diffs.push({
      type: 'selection',
      index,
      reason: words[i].reason,
    });

    const gameState = getGameState(board, currentTeam);
    if (gameState.stage !== 'playing') {
      diffs.push({
        type: 'state',
        newState: gameState,
      });
      break;
    }
    if (board[index].type !== currentTeam) break;
  }

  return diffs;
}
