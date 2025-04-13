import { initTRPC, TRPCError } from '@trpc/server';
import { generateRandomBoard } from '@codenaimes/game/board';
import { canGameStart } from '@codenaimes/game/utils';
import { isWSAttachment } from './utils';
import type { Clue, GameState } from '@codenaimes/game/types';
import { generateGuesses } from './guess';
import { z } from 'zod';
import { type ModelId, models } from '@codenaimes/game/model';
import {
  type ServerUserState,
  type GameStateManager,
  serverToClientUserState,
} from './state';
import type { WebSocketClient } from '@do-utils/birpc';
import type { RpcClientRouter } from '@codenaimes/client-router';

export interface RpcContext {
  stateManager: GameStateManager;
  ws: WebSocket;
  doState: DurableObjectState;
  client: WebSocketClient<RpcClientRouter>;
}

const t = initTRPC.context<RpcContext>().create();

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const attachment = ctx.ws.deserializeAttachment();
  if (!isWSAttachment(attachment))
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });

  const userSessions = await ctx.stateManager.get('userSessions');
  const user = userSessions.get(attachment.sessionId);
  if (!user)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });

  return next({
    ctx: {
      user,
      sessionId: attachment.sessionId,
    },
  });
});

function isModelId(modelId: string): modelId is ModelId {
  return models.some((model) => model.id === modelId);
}

export const rpcRouter = t.router({
  startGame: protectedProcedure.mutation(async ({ ctx }) => {
    const gameState = await ctx.stateManager.get('gameState');
    const userSessions = await ctx.stateManager.get('userSessions');

    if (
      gameState.stage !== 'lobby' ||
      !canGameStart(Array.from(userSessions.values()))
    )
      return;

    const startState: GameState = {
      stage: 'playing',
      board: generateRandomBoard(),
      currentTeam: 'red',
      clues: [],
    };

    await ctx.stateManager.put('gameState', startState);

    ctx.client.send(
      ctx.doState.getWebSockets(),
      ctx.client.builder.createDiffs.mutationOptions({
        diffs: [
          {
            type: 'state',
            state: startState,
          },
        ],
      }),
    );
  }),

  sync: protectedProcedure.query(async ({ ctx }) => {
    const gameState = await ctx.stateManager.get('gameState');
    const userSessions = await ctx.stateManager.get('userSessions');

    ctx.client.send(
      ctx.ws,
      ctx.client.builder.sync.mutationOptions({
        gameState,
        userState: serverToClientUserState(ctx.user),
        users: Array.from(userSessions.values()).map(serverToClientUserState),
      }),
    );
  }),

  giveClue: protectedProcedure
    .input(
      z.object({
        clue: z.object({
          word: z.string(),
          count: z.number(),
        }),
        modelId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const gameState = await ctx.stateManager.get('gameState');
      if (gameState.stage !== 'playing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid game state',
        });
      }

      if (ctx.user.team !== gameState.currentTeam) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not your turn',
        });
      }

      if (!isModelId(input.modelId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid model ID',
        });
      }

      const clue: Clue = {
        count: input.clue.count,
        word: input.clue.word,
        guesserId: ctx.user.id,
        team: ctx.user.team,
      };

      const { diffs, newGameState } = await generateGuesses(
        gameState,
        clue,
        input.modelId,
      );
      await ctx.stateManager.put('gameState', newGameState);

      ctx.client.send(
        ctx.doState.getWebSockets(),
        ctx.client.builder.createDiffs.mutationOptions({
          diffs,
        }),
      );
    }),

  switchTeam: protectedProcedure.mutation(async ({ ctx }) => {
    const gameState = await ctx.stateManager.get('gameState');
    if (gameState.stage !== 'lobby') return;

    const newTeam = ctx.user.team === 'red' ? 'blue' : 'red';
    const newUser: ServerUserState = {
      ...ctx.user,
      team: newTeam,
    };

    const userSessions = await ctx.stateManager.get('userSessions');
    userSessions.set(ctx.sessionId, newUser);
    await ctx.stateManager.put('userSessions', userSessions);

    ctx.client.send(
      ctx.doState.getWebSockets(),
      ctx.client.builder.changePlayerState.mutationOptions({
        userState: serverToClientUserState(newUser),
      }),
    );
  }),
});

export type RPCRouter = typeof rpcRouter;
