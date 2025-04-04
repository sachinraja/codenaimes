import { initTRPC, TRPCError } from '@trpc/server';
import { serverToClientUserState, type ServerUserState } from '../utils/user';
import { generateRandomBoard } from '@codenaimes/game/board';
import { canGameStart } from '@codenaimes/game/utils';
import type { GameStateManager } from '../state';
import { isWSAttachment } from '../utils';
import type { GameState } from '@codenaimes/game/types';
import type { ClientMessage } from '@codenaimes/ws-interface';
import { generateGuesses } from '../guess';
import { z } from 'zod';
import { type ModelId, models } from '@codenaimes/game/model';

export interface RpcContext {
  stateManager: GameStateManager;
  ws: WebSocket;
  doState: DurableObjectState;
}

const t = initTRPC.context<RpcContext>().create();

function send(ws: WebSocket | WebSocket[], message: ClientMessage) {
  const serializedMessage = JSON.stringify(message);
  const clients = Array.isArray(ws) ? ws : [ws];
  for (const client of clients) {
    client.send(serializedMessage);
  }
}

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
      clues: {
        red: [],
        blue: [],
      },
    };

    await ctx.stateManager.put('gameState', startState);

    send(ctx.doState.getWebSockets(), {
      type: 'diff',
      diffs: [
        {
          type: 'state',
          state: startState,
        },
      ],
    });
  }),

  sync: protectedProcedure.query(async ({ ctx }) => {
    const gameState = await ctx.stateManager.get('gameState');
    const userSessions = await ctx.stateManager.get('userSessions');

    send(ctx.ws, {
      type: 'sync',
      gameState,
      userState: serverToClientUserState(ctx.user),
      users: Array.from(userSessions.values()).map(serverToClientUserState),
    });
  }),

  clue: protectedProcedure
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
      if (
        gameState.stage !== 'playing' ||
        ctx.user.team !== gameState.currentTeam
      )
        return;

      if (!isModelId(input.modelId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid model ID',
        });
      }

      const { diffs, newGameState } = await generateGuesses(
        gameState,
        input.clue,
        input.modelId,
      );
      await ctx.stateManager.put('gameState', newGameState);

      send(ctx.doState.getWebSockets(), {
        type: 'diff',
        diffs: diffs,
      });
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

    send(ctx.doState.getWebSockets(), {
      type: 'player-state-change',
      userState: serverToClientUserState(newUser),
    });
  }),
});

export type RpcRouter = typeof rpcRouter;
