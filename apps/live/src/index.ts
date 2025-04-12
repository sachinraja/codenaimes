import { DurableObject } from 'cloudflare:workers';
import type { GameState, Team } from '@codenaimes/game/types';
import { getSessionId } from './utils/user';
import { baseRouter } from './routers/base';
import { type StateManager, createStateManager } from '@do-utils/state-manager';
import {
  createWebSocketHandler,
  type WebSocketHandler,
} from '@do-utils/birpc/server';
import { rpcRouter } from '@codenaimes/live-tools/rpc';
import type { WSAttachment } from '@codenaimes/live-tools/utils';
import {
  serverToClientUserState,
  type ServerUserState,
  type UserSessionMap,
} from '@codenaimes/live-tools/state';
import type { WebSocketClient } from '@do-utils/birpc/client';
import type { RpcClientRouter } from '@codenaimes/client-router';

const OBJECT_TTL_MS = 5 * 60 * 1000;

export class GameDurableObject extends DurableObject<Env> {
  stateManager: StateManager<{
    userSessions: UserSessionMap;
    gameState: GameState;
    created: boolean;
  }>;
  webSocketHandler: WebSocketHandler;
  client: WebSocketClient<RpcClientRouter>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.webSocketHandler = createWebSocketHandler({
      router: rpcRouter,
      getWebSocketConnectionId(ws) {
        const attachment = ws.deserializeAttachment() as WSAttachment;
        return attachment.sessionId;
      },
      createContext: async ({ ws }) => {
        return {
          ws,
          doState: this.ctx,
          stateManager: this.stateManager,
          client: this.client,
        };
      },
    });
    this.client = this.webSocketHandler.createClient<RpcClientRouter>();

    this.ctx.blockConcurrencyWhile(async () => {
      this.stateManager = createStateManager(ctx.storage, {
        userSessions: () => new Map(),
        gameState: () => ({ stage: 'lobby' }),
        created: () => false,
      });
    });
  }

  async fetch(request: Request): Promise<Response> {
    const created = await this.stateManager.get('created');
    if (!created) return new Response('Not found', { status: 404 });
    await this.resetTTL();

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const res = new Response(null, {
      status: 101,
      webSocket: client,
    });

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userSessions = await this.stateManager.get('userSessions');
    const user = userSessions.get(sessionId);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    this.ctx.acceptWebSocket(server);

    const newUser: ServerUserState = {
      ...user,
      connections: user.connections + 1,
    };
    userSessions.set(sessionId, newUser);
    await this.stateManager.put('userSessions', userSessions);

    const attachment: WSAttachment = { sessionId };
    server.serializeAttachment(attachment);

    this.client.send(
      this.ctx.getWebSockets(),
      this.client.builder.changePlayerState.mutationOptions({
        userState: serverToClientUserState(newUser),
      }),
    );

    return res;
  }

  async alarm() {
    await this.stateManager.deleteAll();
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    await this.resetTTL();
    console.log('live received message', message);

    await this.webSocketHandler.webSocketMessage(ws, message);
  }

  async webSocketClose(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as WSAttachment;
    const userSessions = await this.stateManager.get('userSessions');
    const user = userSessions.get(attachment.sessionId);
    if (!user) return;

    const newUser: ServerUserState = {
      ...user,
      connections: user.connections - 1,
    };
    userSessions.set(attachment.sessionId, newUser);
    await this.stateManager.put('userSessions', userSessions);

    this.client.send(
      this.ctx.getWebSockets(),
      this.client.builder.changePlayerState.mutationOptions({
        userState: serverToClientUserState(newUser),
      }),
    );
  }

  async resetTTL() {
    await this.ctx.storage.setAlarm(Date.now() + OBJECT_TTL_MS);
  }

  async createRoom(username: string) {
    await this.stateManager.put('created', true);

    return this.createUser(username);
  }

  async createUser(username: string) {
    const userSessions = await this.stateManager.get('userSessions');
    const team: Team = userSessions.size % 2 === 0 ? 'red' : 'blue';

    const user: ServerUserState = {
      id: crypto.randomUUID(),
      team: team,
      username: username,
      connections: 0,
    };

    const sessionId = crypto.randomUUID();
    userSessions.set(sessionId, user);
    await this.stateManager.put('userSessions', userSessions);

    this.client.send(
      this.ctx.getWebSockets(),
      this.client.builder.changePlayerState.mutationOptions({
        userState: serverToClientUserState(user),
      }),
    );

    return sessionId;
  }
}

export default {
  async fetch(request, ...args): Promise<Response> {
    return baseRouter.fetch(request, ...args, request);
  },
} satisfies ExportedHandler<Env>;
