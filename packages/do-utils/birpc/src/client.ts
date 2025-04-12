import {
  type AnyTRPCRouter,
  createTRPCRecursiveProxy,
  type TRPCRouterRecord,
  type AnyTRPCProcedure,
  type AnyTRPCQueryProcedure,
  type AnyTRPCMutationProcedure,
  type inferProcedureInput,
  type inferProcedureOutput,
  type TRPCCombinedDataTransformer,
  TRPCError,
  getTRPCErrorFromUnknown,
} from '@trpc/server';
import {
  getTransformer,
  type TransformerOptions,
} from '@trpc/client/unstable-internals';
import { TRPCClientError, type TRPCProcedureOptions } from '@trpc/client';
import { parseResponseMessage, type ResponseMessage } from './parse';
import type { OnClose, OnOpen, OnMessage } from './types';
import type {
  ErrorHandlerOptions,
  inferRouterContext,
} from '@trpc/server/unstable-core-do-not-import';
import type { TRPCRequestMessage } from '@trpc/server/rpc';
export interface ProcedureOptions<TProcedure extends AnyTRPCProcedure>
  extends TRPCProcedureOptions {
  path: string;
  method: TProcedure extends AnyTRPCQueryProcedure ? 'query' : 'mutation';
  input: inferProcedureInput<TProcedure>;
  _procedure: TProcedure;
}

type OptionsFactory<TProcedure extends AnyTRPCProcedure> = (
  input: inferProcedureInput<TProcedure>,
  options?: TRPCProcedureOptions,
) => ProcedureOptions<TProcedure>;

type DecorateProcedure<TProcedure> = TProcedure extends AnyTRPCQueryProcedure
  ? {
      queryOptions: OptionsFactory<TProcedure>;
    }
  : TProcedure extends AnyTRPCMutationProcedure
    ? {
        mutationOptions: OptionsFactory<TProcedure>;
      }
    : never;

type DecorateRouterRecord<TRecord extends TRPCRouterRecord> = {
  [TKey in keyof TRecord]: TRecord[TKey] extends infer $Value
    ? $Value extends TRPCRouterRecord
      ? DecorateRouterRecord<$Value>
      : $Value extends AnyTRPCProcedure
        ? DecorateProcedure<$Value>
        : never
    : never;
};

type GetConnectionId = (ws: WebSocket) => string;

interface WebSocketErrorHandlerOptions<TRouter extends AnyTRPCRouter> {
  ws: WebSocket;
  error: TRPCError;
}

export type CreateWebSocketClientOptions<TRouter extends AnyTRPCRouter> = {
  getConnectionId: GetConnectionId;
  onError?: (options: WebSocketErrorHandlerOptions<TRouter>) => void;
} & TransformerOptions<TRouter['_def']['_config']>;

type RPCHandlerMap = Map<string | number, PromiseWithResolvers<unknown>>;
type WebSocketRPCHandlerMap = Map<string, RPCHandlerMap>;

export interface WebSocketClient<TRouter extends AnyTRPCRouter> {
  /**
   * A proxy to create options for procedure calls.
   */
  builder: DecorateRouterRecord<TRouter['_def']['record']>;

  /**
   * Calls a procedure on the the server without expecting a result.
   */
  send(
    ws: WebSocket | WebSocket[],
    options: ProcedureOptions<AnyTRPCProcedure>,
  ): void;

  /**
   * Calls a procedure on the server and returns the result.
   */
  call<TProcedure extends AnyTRPCProcedure>(
    ws: WebSocket,
    options: ProcedureOptions<TProcedure>,
  ): Promise<inferProcedureOutput<TProcedure>>;
  call<TProcedure extends AnyTRPCProcedure>(
    ws: WebSocket[],
    options: ProcedureOptions<TProcedure>,
  ): Promise<inferProcedureOutput<TProcedure>>[];

  onOpen: OnOpen;
  onClose: OnClose;
  onMessage: OnMessage;

  /**
   * private properties used by internals
   */
  _internal: {
    transformer: TRPCCombinedDataTransformer;
    onMessage(ws: WebSocket, message: ResponseMessage): Promise<void>;
    createMessage(
      id: string | null,
      options: ProcedureOptions<AnyTRPCProcedure>,
    ): TRPCRequestMessage;
    createCallResolver(
      ws: WebSocket,
      message: TRPCRequestMessage,
    ): PromiseWithResolvers<unknown>;
  };
}

export function createWebSocketClient<TClientRouter extends AnyTRPCRouter>(
  options: CreateWebSocketClientOptions<TClientRouter>,
): WebSocketClient<TClientRouter> {
  const { transformer, getConnectionId } = options;
  const dataTransformer = getTransformer(transformer);

  const wsRPCHandlerMap: WebSocketRPCHandlerMap = new Map();

  const builder = createTRPCRecursiveProxy<
    DecorateRouterRecord<TClientRouter['_def']['record']>
  >((opts) => {
    const path = [...opts.path];
    const method = path.pop() as 'queryOptions' | 'mutationOptions';
    const dotPath = path.join('.');

    const [input, baseOptions = {}] = opts.args as [
      inferProcedureInput<AnyTRPCProcedure>,
      TRPCProcedureOptions?,
    ];

    const procedureOptions = {
      path: dotPath,
      method: method === 'queryOptions' ? 'query' : 'mutation',
      input,
      ...baseOptions,
    } as ProcedureOptions<AnyTRPCProcedure>;

    return procedureOptions;
  });

  function createMessage(
    id: string | null,
    options: ProcedureOptions<AnyTRPCProcedure>,
  ): TRPCRequestMessage {
    const { path, method, input } = options;
    return {
      id,
      jsonrpc: '2.0',
      method,
      params: {
        input: dataTransformer.input.serialize(input),
        path,
      },
    };
  }

  function getRPCHandlerMap(connectionId: string) {
    const rpcHandlerMap = wsRPCHandlerMap.get(connectionId);
    if (!rpcHandlerMap)
      throw new Error('WebSocket did not have an RPC handler map');
    return rpcHandlerMap;
  }

  return {
    _internal: {
      transformer: dataTransformer,
      async onMessage(ws, message) {
        if (!message.id) {
          if (message.result.type === 'error') {
            const error = getTRPCErrorFromUnknown(message.result.error);
            options.onError?.({ ws, error });
            return;
          }
          throw new Error('Message did not have an ID');
        }
        const connectionId = getConnectionId(ws);
        const rpcHandlerMap = getRPCHandlerMap(connectionId);

        const resolver = rpcHandlerMap.get(message.id);
        if (!resolver) return;

        rpcHandlerMap.delete(message.id);

        if (message.result.type === 'error') {
          resolver.reject(
            TRPCClientError.from({
              error: message.result.error,
            }),
          );
        } else {
          resolver.resolve(message.result.data);
        }
      },
      createMessage,
      createCallResolver(ws, message) {
        if (!message.id) throw new Error('Message did not have an ID');

        const connectionId = getConnectionId(ws);

        const resolver =
          Promise.withResolvers<inferProcedureOutput<AnyTRPCProcedure>>();
        const rpcHandlerMap = getRPCHandlerMap(connectionId);
        rpcHandlerMap.set(message.id, resolver);
        return resolver;
      },
    },
    builder,
    async onOpen(ws) {
      const connectionId = getConnectionId(ws);
      const rpcHandlerMap = wsRPCHandlerMap.get(connectionId);
      if (rpcHandlerMap)
        throw new Error(
          'WebSocket already connected - Make sure to use a unique connection ID',
        );
      wsRPCHandlerMap.set(connectionId, new Map());
    },

    async onClose(ws) {
      console.log('closing');
      const connectionId = getConnectionId(ws);
      const rpcHandlerMap = wsRPCHandlerMap.get(connectionId);
      if (!rpcHandlerMap) return;

      for (const { reject } of rpcHandlerMap.values()) {
        reject(
          new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Disconnected',
          }),
        );
      }

      wsRPCHandlerMap.delete(connectionId);
    },
    async onMessage(ws, message) {
      const messageJSON = JSON.parse(message.toString());

      if (Array.isArray(messageJSON)) {
        await Promise.all(
          messageJSON.map((message) => {
            const parsedMessage = parseResponseMessage(
              message,
              dataTransformer,
            );

            if (!parsedMessage)
              throw new Error('Received invalid response message');

            return this._internal.onMessage(ws, parsedMessage);
          }),
        );
      } else {
        const parsedMessage = parseResponseMessage(
          messageJSON,
          dataTransformer,
        );
        if (!parsedMessage)
          throw new Error('Received invalid response message');

        await this._internal.onMessage(ws, parsedMessage);
      }
    },
    send(
      ws: WebSocket | WebSocket[],
      options: ProcedureOptions<AnyTRPCProcedure>,
    ) {
      const sockets = Array.isArray(ws) ? ws : [ws];

      const message = createMessage(null, options);
      const serializedMessage = JSON.stringify(message);

      for (const socket of sockets) socket.send(serializedMessage);
    },
    call<TProcedure extends AnyTRPCProcedure>(
      ws: WebSocket | WebSocket[],
      options: ProcedureOptions<TProcedure>,
    ): any {
      const id = crypto.randomUUID();
      const message = createMessage(id, options);
      const serializedMessage = JSON.stringify(message);

      if (Array.isArray(ws)) {
        const promises = ws.map((socket) => {
          const resolver = this._internal.createCallResolver(socket, message);
          socket.send(serializedMessage);
          return resolver.promise;
        });

        return Promise.all(promises);
      }

      const resolver = this._internal.createCallResolver(ws, message);
      ws.send(serializedMessage);
      return resolver.promise;
    },
  };
}
