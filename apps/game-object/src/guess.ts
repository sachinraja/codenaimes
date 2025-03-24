import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import type {
  Board,
  Clue,
  GameState,
  PlayingGameState,
} from '@codenaimes/game/types';
import type { Diff } from '@codenaimes/ws-interface/diff';
import { getOtherTeam } from '@codenaimes/game/utils';
import { env } from 'cloudflare:workers';

export async function generateGuesses(gameState: PlayingGameState, clue: Clue) {
  const wordList = gameState.board
    .filter(({ revealed }) => !revealed)
    .map(({ word }) => word);

  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

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

  const diffs: Diff[] = [
    {
      type: 'clue',
      team: gameState.currentTeam,
      clue,
    },
  ];
  const newBoard: Board = [...gameState.board];
  const otherTeam = getOtherTeam(gameState.currentTeam);
  let newState: GameState | null = null;
  const newClues: PlayingGameState['clues'] = {
    ...gameState.clues,
    [gameState.currentTeam]: [...gameState.clues[gameState.currentTeam], clue],
  };

  for (let i = 0; i < words.length; i++) {
    const index = gameState.board.findIndex((w) => w.word === words[i].word);
    if (index === -1) {
      console.error('Word not found in board', words[i].word);
      continue;
    }

    newBoard[index] = {
      ...newBoard[index],
      revealed: true,
      reason: words[i].reason,
    };

    diffs.push({
      type: 'selection',
      index,
    });

    const guessedWord = newBoard[index];

    if (guessedWord.type === 'assassin') {
      newState = {
        stage: 'complete',
        board: newBoard,
        winner: gameState.currentTeam === 'red' ? 'blue' : 'red',
        clues: newClues,
      };
      diffs.push({
        type: 'state',
        state: newState,
      });
      break;
    }

    if (guessedWord.type === gameState.currentTeam) {
      const currentTeamWon = newBoard.every(
        (word) => word.type === gameState.currentTeam,
      );
      if (currentTeamWon) {
        newState = {
          stage: 'complete',
          board: newBoard,
          winner: gameState.currentTeam,
          clues: newClues,
        };
        diffs.push({
          type: 'state',
          state: newState,
        });
        break;
      }
    }

    if (guessedWord.type === 'neutral') {
      newState = {
        stage: 'playing',
        board: newBoard,
        currentTeam: otherTeam,
        clues: newClues,
      };
      diffs.push({
        type: 'state',
        state: newState,
      });
      break;
    }

    if (guessedWord.type === otherTeam) {
      const otherTeamWon = newBoard.every((word) => word.type === otherTeam);
      if (otherTeamWon) {
        newState = {
          stage: 'complete',
          board: newBoard,
          winner: otherTeam,
          clues: newClues,
        };
        diffs.push({
          type: 'state',
          state: newState,
        });
        break;
      }

      newState = {
        stage: 'playing',
        board: newBoard,
        currentTeam: otherTeam,
        clues: newClues,
      };
      diffs.push({
        type: 'state',
        state: newState,
      });
      break;
    }
  }

  if (!newState) {
    newState = {
      stage: 'playing',
      board: newBoard,
      currentTeam: getOtherTeam(gameState.currentTeam),
      clues: newClues,
    };
    diffs.push({
      type: 'state',
      state: newState,
    });
  }

  return {
    diffs,
    newState,
  };
}
