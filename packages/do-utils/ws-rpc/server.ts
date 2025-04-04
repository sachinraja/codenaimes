import {
  callTRPCProcedure,
  getErrorShape,
  type ProcedureType,
  transformTRPCResponse,
  TRPCError,
  type AnyTRPCRouter,
  type inferRouterContext,
} from '@trpc/server';
import {
  parseTRPCMessage,
  type TRPCResponseMessage,
  type TRPCClientOutgoingMessage,
} from '@trpc/server/rpc';

export type CreateWebSocketContextOptions = {
  ws: WebSocket;
};

type CreateContext<TContext> = (
  opts: CreateWebSocketContextOptions,
) => TContext | Promise<TContext>;

interface ErrorHandlerOptions<TContext> {
  ws: WebSocket;
  error: TRPCError;
  type: ProcedureType | 'unknown';
  path: string | undefined;
  input: unknown;
  ctx: TContext | undefined;
}

export interface CreateWebSocketHandlerOptions<TRouter extends AnyTRPCRouter> {
  router: TRouter;
  createContext: CreateContext<inferRouterContext<TRouter>>;
  onError?: (opts: ErrorHandlerOptions<inferRouterContext<TRouter>>) => void;
  dangerouslyDisablePong?: boolean;
}

async function handleMessage(
  ctx: unknown,
  router: AnyTRPCRouter,
  ws: WebSocket,
  message: TRPCClientOutgoingMessage,
) {
  const { id } = message;
  if (id === null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '`id` is required',
    });
  }

  const type = message.method;
  if (type === 'subscription' || type === 'subscription.stop') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Subscriptions are not supported',
    });
  }

  const { path, input } = message.params;

  const result = await callTRPCProcedure({
    router,
    path,
    getRawInput: async () => input,
    ctx,
    type,
    signal: undefined,
  });

  ws.send(JSON.stringify(transformTRPCResponse(router._def._config, result)));
}

export interface WebSocketHandler<TRouter extends AnyTRPCRouter> {
  webSocketMessage: (
    ws: WebSocket,
    message: string | ArrayBuffer,
  ) => Promise<void>;
}

export function createWebSocketHandler<TRouter extends AnyTRPCRouter>(
  opts: CreateWebSocketHandlerOptions<TRouter>,
): WebSocketHandler<TRouter> {
  const { router, createContext } = opts;
  const { transformer } = router._def._config;

  function respond(ws: WebSocket, untransformedJSON: TRPCResponseMessage) {
    ws.send(
      JSON.stringify(
        transformTRPCResponse(router._def._config, untransformedJSON),
      ),
    );
  }

  return {
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
      const ctx = await createContext({ ws });

      const msgStr = message.toString();
      if (msgStr === 'PONG') return;
      if (msgStr === 'PING') {
        if (!opts.dangerouslyDisablePong) ws.send('PONG');
        return;
      }
      try {
        const msgJSON: unknown = JSON.parse(msgStr);
        const msgs: unknown[] = Array.isArray(msgJSON) ? msgJSON : [msgJSON];
        const promises = msgs
          .map((raw) => parseTRPCMessage(raw, transformer))
          .map((msg) => handleMessage(ctx, router, ws, msg));
        await Promise.all(promises);
      } catch (cause) {
        const error = new TRPCError({
          code: 'PARSE_ERROR',
          cause,
        });

        respond(ws, {
          id: null,
          error: getErrorShape({
            config: router._def._config,
            error,
            type: 'unknown',
            path: undefined,
            input: undefined,
            ctx: undefined,
          }),
        });
      }
    },
  };
}
