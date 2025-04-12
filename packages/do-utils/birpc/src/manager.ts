import type {
  AnyTRPCProcedure,
  AnyTRPCRouter,
  inferProcedureOutput,
} from '@trpc/server';
import type { ProcedureOptions, WebSocketClient } from './client';

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_BASE_RECONNECT_DELAY = 1000;

export interface CreateWebSocketManagerOptions {
  url: string;
  onOpen?: (ws: WebSocket, ev: Event) => void;
  onClose?: (ws: WebSocket, ev: Event) => void;
  onMessage?: (ws: WebSocket, ev: MessageEvent) => void;
  onError?: (ws: WebSocket, ev: Event) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface WebSocketManager {
  sendMessage: (message: string) => Promise<void>;
  close: () => void;
  getWebSocket: () => WebSocket;
}

export function createWebSocketManager({
  url,
  onOpen,
  onClose,
  onMessage,
  onError,
  reconnectAttempts: maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
  reconnectDelay: baseReconnectDelay = DEFAULT_BASE_RECONNECT_DELAY,
}: CreateWebSocketManagerOptions): WebSocketManager {
  let isClosed = false;
  const openPromises: PromiseWithResolvers<void>[] = [];
  let reconnectAttempts = 0;

  let webSocket = createWebSocket(url);

  function createWebSocket(url: string) {
    const ws = new WebSocket(url);

    ws.onopen = (ev) => {
      // reset reconnect attempts on successful connection
      reconnectAttempts = 0;
      onOpen?.(ws, ev);
      for (const openPromise of openPromises) {
        openPromise.resolve();
      }
    };

    ws.onclose = (ev) => {
      if (isClosed) return;
      onClose?.(ws, ev);

      // try reconnect
      reconnectAttempts += 1;
      if (reconnectAttempts > maxReconnectAttempts) {
        // reject all open promises if max reconnect attempts reached
        for (const openPromise of openPromises) {
          openPromise.reject(new Error('Max reconnect attempts reached'));
        }
        throw new Error(
          `Reached max reconnect attempts (${maxReconnectAttempts}), closing connection`,
        );
      }
      const delay = baseReconnectDelay * 2 ** reconnectAttempts;
      setTimeout(() => {
        webSocket = createWebSocket(url);
      }, delay);
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
      if (webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(message);
        return;
      }

      const resolver = Promise.withResolvers<void>();
      openPromises.push(resolver);
      await resolver.promise;

      webSocket.send(message);
    },
    close() {
      if (isClosed) throw new Error('WebSocket is closed');

      isClosed = true;
      onClose?.(webSocket, new Event('close'));
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

export interface CreateManagedClientOptions<TRouter extends AnyTRPCRouter> {
  manager: WebSocketManager;
  client: WebSocketClient<TRouter>;
}

export interface ManagedClient<TRouter extends AnyTRPCRouter> {
  builder: WebSocketClient<TRouter>['builder'];
  call<TProcedure extends AnyTRPCProcedure>(
    procedureOptions: ProcedureOptions<TProcedure>,
  ): Promise<inferProcedureOutput<TProcedure>>;
  send<TProcedure extends AnyTRPCProcedure>(
    procedureOptions: ProcedureOptions<TProcedure>,
  ): void;
}

export function createManagedClient<TRouter extends AnyTRPCRouter>({
  client,
  manager,
}: CreateManagedClientOptions<TRouter>): ManagedClient<TRouter> {
  return {
    builder: client.builder,
    async call(procedureOptions) {
      const message = client._internal.createMessage(
        crypto.randomUUID(),
        procedureOptions,
      );
      const resolver = client._internal.createCallResolver(
        manager.getWebSocket(),
        message,
      );
      const serializedMessage = JSON.stringify(message);
      await manager.sendMessage(serializedMessage);
      return resolver.promise;
    },
    send(procedureOptions) {
      const message = client._internal.createMessage(
        crypto.randomUUID(),
        procedureOptions,
      );
      const serializedMessage = JSON.stringify(message);
      manager.sendMessage(serializedMessage);
    },
  };
}
