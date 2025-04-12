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
} from '@trpc/server';
import {
  getTransformer,
  type TransformerOptions,
} from '@trpc/client/unstable-internals';
import type { RPCHandlerMap } from './common';
import type { TRPCProcedureOptions } from '@trpc/client';

interface ProcedureOptions<TProcedure extends AnyTRPCProcedure>
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

export interface WebSocketClient<TRouter extends AnyTRPCRouter> {
  builder: DecorateRouterRecord<TRouter['_def']['record']>;
  send(
    ws: WebSocket | WebSocket[],
    options: ProcedureOptions<AnyTRPCProcedure>,
  ): void;
  call<TProcedure extends AnyTRPCProcedure>(
    ws: WebSocket,
    options: ProcedureOptions<TProcedure>,
  ): Promise<inferProcedureOutput<TProcedure>>;
  call<TProcedure extends AnyTRPCProcedure>(
    ws: WebSocket[],
    options: ProcedureOptions<TProcedure>,
  ): Promise<inferProcedureOutput<TProcedure>>[];
}

export type CreateWebSocketClientOptions<TRouter extends AnyTRPCRouter> =
  TransformerOptions<TRouter['_def']['_config']>;

interface CreateWebSocketManagerOptions {
  url: string;
  onConnect?: (ws: WebSocket, ev: Event) => void;
  onDisconnect?: (ws: WebSocket, ev: Event) => void;
  onMessage?: (ws: WebSocket, ev: MessageEvent) => void;
  onError?: (ws: WebSocket, ev: Event) => void;
}

export interface WebSocketManager {
  sendMessage: (message: string) => Promise<void>;
  close: () => void;
  getWebSocket: () => WebSocket;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

export function createPromise<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: (value: T) => resolve(value),
    reject: (reason?: any) => reject(reason),
  };
}

export function createWebSocketManager({
  url,
  onConnect,
  onDisconnect,
  onMessage,
  onError,
}: CreateWebSocketManagerOptions): WebSocketManager {
  let isClosed = false;
  const openPromises: ReturnType<typeof createPromise<void>>[] = [];
  let reconnectAttempts = 0;

  let webSocket = createWebSocket(url);

  function createWebSocket(url: string) {
    const ws = new WebSocket(url);

    ws.onopen = (ev) => {
      // reset reconnect attempts on successful connection
      reconnectAttempts = 0;
      onConnect?.(ws, ev);
      for (const openPromise of openPromises) {
        openPromise.resolve();
      }
    };

    ws.onclose = (ev) => {
      if (isClosed) return;
      onDisconnect?.(ws, ev);

      // try reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts += 1;
        const delay = BASE_RECONNECT_DELAY * 2 ** reconnectAttempts;
        setTimeout(() => {
          webSocket = createWebSocket(url);
        }, delay);
      } else {
        throw new Error(
          `Max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}), closing connection`,
        );
      }
    };

    ws.onerror = (ev) => {
      if (isClosed) return;
      onError?.(ws, ev);
    };

    ws.onmessage = (ev) => {
      onMessage?.(ws, ev);
    };

    return ws;
  }

  return {
    async sendMessage(message) {
      if (isClosed) throw new Error('WebSocket is closed');

      const openPromise = createPromise<void>();
      openPromises.push(openPromise);
      await openPromise.promise;

      webSocket.send(message);
    },
    close() {
      console.log('closing');
      isClosed = true;
      for (const openPromise of openPromises) {
        openPromise.reject(new Error('WebSocket is closed'));
      }
      webSocket.close();
    },
    getWebSocket() {
      if (isClosed) throw new Error('WebSocket is closed');
      return webSocket;
    },
  };
}

export function createWebSocketClient<TClientRouter extends AnyTRPCRouter>(
  getRPCHandlerMap: (ws: WebSocket) => RPCHandlerMap,
  options: CreateWebSocketClientOptions<TClientRouter>,
): WebSocketClient<TClientRouter> {
  const { transformer } = options;
  const dataTransformer = getTransformer(transformer);

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

  function getMessage(
    id: string | null,
    transformer: TRPCCombinedDataTransformer,
    options: ProcedureOptions<AnyTRPCProcedure>,
  ) {
    const { path, method, input } = options;
    return {
      id,
      jsonrpc: '2.0',
      method,
      params: {
        input: transformer.input.serialize(input),
        path,
      },
    };
  }

  return {
    builder,
    send(
      ws: WebSocket | WebSocket[],
      options: ProcedureOptions<AnyTRPCProcedure>,
    ) {
      const sockets = Array.isArray(ws) ? ws : [ws];

      const message = getMessage(null, dataTransformer, options);
      console.log('sent message', message);
      const strMessage = JSON.stringify(message);

      for (const socket of sockets) socket.send(strMessage);
    },
    call<TProcedure extends AnyTRPCProcedure>(
      ws: WebSocket | WebSocket[],
      options: ProcedureOptions<TProcedure>,
    ): any {
      const id = crypto.randomUUID();

      const message = getMessage(id, dataTransformer, options);
      console.log('called with message', message);
      const strMessage = JSON.stringify(message);

      if (Array.isArray(ws)) {
        const promises = ws.map((socket) => {
          const rpcHandlerMap = getRPCHandlerMap(socket);

          return new Promise<inferProcedureOutput<TProcedure>>(
            (resolve, reject) => {
              rpcHandlerMap.set(id, {
                resolve,
                reject,
              });
            },
          );
        });

        for (const socket of ws) socket.send(strMessage);

        return promises;
      }

      const rpcHandlerMap = getRPCHandlerMap(ws);

      const promise = new Promise<inferProcedureOutput<TProcedure>>(
        (resolve, reject) => {
          rpcHandlerMap.set(id, {
            resolve,
            reject,
          });
        },
      );

      ws.send(strMessage);

      return promise;
    },
  };
}
