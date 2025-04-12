import type { AnyTRPCRouter } from '@trpc/server';
import type { WebSocketClient } from './client';
import {
  createManagedClient,
  createWebSocketManager,
  type CreateWebSocketManagerOptions,
} from './manager';
import type { WebSocketHandler } from './server';
import { splitOnMessage } from './split';

interface CreateBirpcOptions<TRouter extends AnyTRPCRouter>
  extends CreateWebSocketManagerOptions {
  handler: WebSocketHandler;
  client: WebSocketClient<TRouter>;
  url: string;
}

export function createBirpc<TRouter extends AnyTRPCRouter>(
  options: CreateBirpcOptions<TRouter>,
) {
  const { client, handler } = options;
  const onMessage = splitOnMessage({
    client: options.client,
    handler: options.handler,
  });
  const manager = createWebSocketManager({
    ...options,
    async onOpen(ws, ev) {
      await Promise.all([handler.onOpen(ws), client.onOpen(ws)]);
      options.onOpen?.(ws, ev);
    },
    async onClose(ws, ev) {
      await Promise.all([handler.onClose(ws), client.onClose(ws)]);
      options.onClose?.(ws, ev);
    },
    onMessage: (ws, ev) => {
      onMessage(ws, ev);
      options.onMessage?.(ws, ev);
    },
  });

  const managedClient = createManagedClient({
    manager,
    client,
  });

  return { managedClient, manager };
}
