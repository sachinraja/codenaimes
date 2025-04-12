import {
  callTRPCProcedure,
  getErrorShape,
  type TRPCProcedureType,
  type TRPCError,
  type AnyTRPCRouter,
  type inferRouterContext,
  getTRPCErrorFromUnknown,
  type TRPCCombinedDataTransformer,
} from '@trpc/server';
import type { OnClose, OnOpen, OnMessage } from './types';
import { parseRequestMessage, type RequestMessage } from './parse';
import { getResponder } from './utils';

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
  onError?: (opts: ErrorHandlerOptions<inferRouterContext<TRouter>>) => void;
}

export interface WebSocketHandler {
  onOpen: OnOpen;
  onClose: OnClose;
  onMessage: OnMessage;

  /**
   * private properties used by internals
   */
  _internal: {
    transformer: TRPCCombinedDataTransformer;
    onMessage(ws: WebSocket, message: RequestMessage): Promise<void>;
  };
}

export function createWebSocketHandler<TRouter extends AnyTRPCRouter>(
  opts: CreateWebSocketHandlerOptions<TRouter>,
): WebSocketHandler {
  const { router, createContext } = opts;

  const respond = getResponder(router);
  return {
    _internal: {
      transformer: router._def._config.transformer,
      async onMessage(ws: WebSocket, message: RequestMessage) {
        const ctx = await createContext({ ws });

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
      },
    },
    async onOpen() {},
    async onClose() {},
    async onMessage(ws: WebSocket, message: string | ArrayBuffer) {
      const messageJSON = JSON.parse(message.toString());

      if (Array.isArray(messageJSON)) {
        await Promise.all(
          messageJSON.map((message) => {
            const parsedMessage = parseRequestMessage(
              message,
              router._def._config.transformer,
            );

            if (!parsedMessage)
              throw new Error('Received invalid request message');

            return this._internal.onMessage(ws, parsedMessage);
          }),
        );
      } else {
        const parsedMessage = parseRequestMessage(
          messageJSON,
          router._def._config.transformer,
        );
        if (!parsedMessage) throw new Error('Received invalid request message');

        await this._internal.onMessage(ws, parsedMessage);
      }
    },
  };
}
