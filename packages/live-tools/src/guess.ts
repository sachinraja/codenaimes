import { generateObject, type LanguageModelV1 } from 'ai';
import { z } from 'zod';
import type {
  Board,
  Clue,
  GameState,
  PlayingGameState,
} from '@codenaimes/game/types';
import type { Diff } from '@codenaimes/game/diff';
import { getOtherTeam } from '@codenaimes/game/utils';
import { env } from 'cloudflare:workers';
import type { ModelId } from '@codenaimes/game/model';
import { createWorkersAI } from 'workers-ai-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

const modelIdToModelMap: Record<ModelId, () => LanguageModelV1> = {
  'gemini-flash-2.0': () =>
    createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    })('gemini-2.0-flash-001'),

  'gpt-4o-mini': () =>
    createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    })('gpt-4o-mini'),

  'llama-3.3-70b-instruct': () =>
    createWorkersAI({
      binding: env.AI,
    })('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),

  'claude-3.5-haiku': () =>
    createAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    })('claude-3-5-haiku-latest'),
};

export async function generateGuesses(
  gameState: PlayingGameState,
  clue: Clue,
  modelId: ModelId,
) {
  const wordList = gameState.board
    .filter(({ revealed }) => !revealed)
    .map(({ word }) => word);

  const { object } = await generateObject({
    model: modelIdToModelMap[modelId](),
    maxRetries: 0,
    schema: z.object({
      words: z
        .object({
          word: z.enum(wordList as [string, ...string[]]),
          reason: z.string(),
        })
        .array()
        .length(clue.count),
    }),
    prompt: `Pick ${clue.count} word${clue.count === 1 ? '' : 's'} that most closely relate${clue.count === 1 ? 's' : ''} to the clue from the the following list of words and rank them in order of relevance. Provide a short reason explaining your logic ${
      clue.count === 1 ? 'for the word' : 'for each word'
    }:\nClue: ${clue.word}\nList:\n${wordList.join('\n')}`,
  });
  const words = object.words;

  const diffs: Diff[] = [
    {
      type: 'clue',
      team: gameState.currentTeam,
      clue,
    },
  ];
  const newBoard: Board = [...gameState.board];
  const otherTeam = getOtherTeam(gameState.currentTeam);
  let newGameState: GameState | null = null;
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
      newGameState = {
        stage: 'complete',
        board: newBoard,
        winner: gameState.currentTeam === 'red' ? 'blue' : 'red',
        clues: newClues,
      };
      diffs.push({
        type: 'state',
        state: newGameState,
      });
      break;
    }

    if (guessedWord.type === gameState.currentTeam) {
      const teamWords = newBoard.filter(
        (word) => word.type === gameState.currentTeam,
      );
      const currentTeamWon = teamWords.every((word) => word.revealed);

      if (currentTeamWon) {
        newGameState = {
          stage: 'complete',
          board: newBoard,
          winner: gameState.currentTeam,
          clues: newClues,
        };
        diffs.push({
          type: 'state',
          state: newGameState,
        });
        break;
      }
    }

    if (guessedWord.type === 'neutral') {
      newGameState = {
        stage: 'playing',
        board: newBoard,
        currentTeam: otherTeam,
        clues: newClues,
      };
      diffs.push({
        type: 'state',
        state: newGameState,
      });
      break;
    }

    if (guessedWord.type === otherTeam) {
      const teamWords = newBoard.filter((word) => word.type === otherTeam);
      const otherTeamWon = teamWords.every((word) => word.revealed);

      if (otherTeamWon) {
        newGameState = {
          stage: 'complete',
          board: newBoard,
          winner: otherTeam,
          clues: newClues,
        };
        diffs.push({
          type: 'state',
          state: newGameState,
        });
        break;
      }

      newGameState = {
        stage: 'playing',
        board: newBoard,
        currentTeam: otherTeam,
        clues: newClues,
      };
      diffs.push({
        type: 'state',
        state: newGameState,
      });
      break;
    }
  }

  if (!newGameState) {
    newGameState = {
      stage: 'playing',
      board: newBoard,
      currentTeam: getOtherTeam(gameState.currentTeam),
      clues: newClues,
    };
    diffs.push({
      type: 'state',
      state: newGameState,
    });
  }

  return {
    diffs,
    newGameState,
  };
}
