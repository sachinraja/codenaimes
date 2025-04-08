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
      const strMessage = JSON.stringify(message);

      for (const socket of sockets) socket.send(strMessage);
    },

    call<TProcedure extends AnyTRPCProcedure>(
      ws: WebSocket | WebSocket[],
      options: ProcedureOptions<TProcedure>,
    ): any {
      const id = crypto.randomUUID();

      const message = getMessage(id, dataTransformer, options);
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

      const promise = new Promise<inferProcedureOutput<TProcedure>>(
        (resolve, reject) => {
          const rpcHandlerMap = getRPCHandlerMap(ws);

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
