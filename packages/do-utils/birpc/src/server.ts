import {
  callTRPCProcedure,
  getErrorShape,
  type TRPCProcedureType,
  transformTRPCResponse,
  TRPCError,
  type AnyTRPCRouter,
  type inferRouterContext,
  getTRPCErrorFromUnknown,
} from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import {
  createWebSocketClient,
  type CreateWebSocketClientOptions,
  type WebSocketClient,
} from './client';
import type { WebSocketRPCHandlerMap } from './common';
import {
  parseMessage,
  type RequestMessage,
  type ResponseMessage,
} from './parse';
import { TRPCClientError } from '@trpc/client';

export type CreateWebSocketContextOptions = {
  ws: WebSocket;
};

type CreateContext<TContext> = (
  opts: CreateWebSocketContextOptions,
) => TContext | Promise<TContext>;

interface ErrorHandlerOptions<TContext> {
  ws: WebSocket;
  error: TRPCError;
  type: TRPCProcedureType | 'unknown';
  path: string | undefined;
  input: unknown;
  ctx: TContext | undefined;
}

export interface CreateWebSocketHandlerOptions<TRouter extends AnyTRPCRouter> {
  router: TRouter;
  createContext: CreateContext<inferRouterContext<TRouter>>;
  getWebSocketConnectionId: (ws: WebSocket) => string;
  onError?: (opts: ErrorHandlerOptions<inferRouterContext<TRouter>>) => void;
  dangerouslyDisablePong?: boolean;
}

export interface WebSocketHandler {
  createClient<TRouter extends AnyTRPCRouter>(
    options?: CreateWebSocketClientOptions<TRouter>,
  ): WebSocketClient<TRouter>;
  webSocketConnect(ws: WebSocket): Promise<void>;
  webSocketClose(ws: WebSocket): Promise<void>;
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
}

export function createWebSocketHandler<TRouter extends AnyTRPCRouter>(
  opts: CreateWebSocketHandlerOptions<TRouter>,
): WebSocketHandler {
  const { router, createContext } = opts;
  const { transformer } = router._def._config;
  const webSocketRPCHandlerMap: WebSocketRPCHandlerMap = new Map();

  function respond(ws: WebSocket, untransformedJSON: TRPCResponseMessage) {
    ws.send(
      JSON.stringify(
        transformTRPCResponse(router._def._config, untransformedJSON),
      ),
    );
  }

  async function handleMessage(
    ctx: unknown,
    router: AnyTRPCRouter,
    ws: WebSocket,
    message: RequestMessage | ResponseMessage,
  ) {
    if (message.type === 'request') {
      try {
        const result = await callTRPCProcedure({
          router,
          path: message.path,
          getRawInput: async () => message.input,
          ctx,
          type: message.method,
          signal: undefined,
        });

        if (message.id !== null)
          respond(ws, {
            id: message.id,
            jsonrpc: message.jsonrpc,
            result: {
              type: 'data',
              data: result,
            },
          });
      } catch (cause) {
        const error = getTRPCErrorFromUnknown(cause);
        opts.onError?.({
          ws,
          error,
          path: message.path,
          type: message.method,
          ctx,
          input: message.input,
        });
        respond(ws, {
          id: message.id,
          jsonrpc: message.jsonrpc,
          error: getErrorShape({
            config: router._def._config,
            error,
            type: message.method,
            path: message.path,
            input: message.input,
            ctx,
          }),
        });
      }
      return;
    }

    const rpcHandlerMap = webSocketRPCHandlerMap.get(
      opts.getWebSocketConnectionId(ws),
    );
    if (!rpcHandlerMap)
      throw new Error('WebSocket did not have an RPC handler map');
    if (!message.id) throw new Error('Message did not have an ID');

    const handler = rpcHandlerMap.get(message.id);
    if (!handler) return;

    rpcHandlerMap.delete(message.id);

    if (message.result.type === 'error') {
      handler.reject(
        TRPCClientError.from({
          error: message.result.error,
        }),
      );
    } else {
      handler.resolve(message.result.data);
    }
  }

  return {
    createClient(options) {
      return createWebSocketClient(
        (ws) => {
          const rpcHandlerMap = webSocketRPCHandlerMap.get(
            opts.getWebSocketConnectionId(ws),
          );
          if (!rpcHandlerMap)
            throw new Error('WebSocket did not have an RPC handler map');
          return rpcHandlerMap;
        },
        options ?? ({} as CreateWebSocketClientOptions<TRouter>),
      );
    },

    async webSocketConnect(ws) {
      const connectionId = opts.getWebSocketConnectionId(ws);
      const rpcHandlerMap = webSocketRPCHandlerMap.get(connectionId);
      if (rpcHandlerMap)
        throw new Error(
          'WebSocket already connected - Make sure to use a unique connection ID',
        );
      webSocketRPCHandlerMap.set(connectionId, new Map());
    },

    async webSocketClose(ws) {
      const connectionId = opts.getWebSocketConnectionId(ws);
      const rpcHandlerMap = webSocketRPCHandlerMap.get(connectionId);
      if (!rpcHandlerMap) return;

      for (const [, { reject }] of rpcHandlerMap.entries()) {
        reject(
          new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Disconnected',
          }),
        );
      }

      webSocketRPCHandlerMap.delete(connectionId);
    },

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
          .map((raw) => parseMessage(raw, transformer))
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
