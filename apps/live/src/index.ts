import { DurableObject } from 'cloudflare:workers';
import type { GameState, Team } from '@codenaimes/game/types';
import { generateRandomBoard } from '@codenaimes/game/board';
import type { ClientMessage, ServerMessage } from '@codenaimes/ws-interface';
import { generateGuesses } from './guess';
import {
  getSessionId,
  serverToClientUserState,
  type ServerUserState,
  type UserSessionMap,
} from './utils/user';
import { baseRouter } from './routers/base';
import { canGameStart } from '@codenaimes/game/utils';
import { type StateManager, createStateManager } from '@do-utils/state-manager';

const OBJECT_TTL_MS = 5 * 60 * 1000;

interface WSAttachment {
  sessionId: string;
}

export class GameDurableObject extends DurableObject<Env> {
  stateManager: StateManager<{
    userSessions: UserSessionMap;
    gameState: GameState;
    created: boolean;
  }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

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

    const attachment: WSAttachment = { sessionId: sessionId };
    server.serializeAttachment(attachment);

    this.sendToAllClients({
      type: 'player-state-change',
      userState: serverToClientUserState(newUser),
    });

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
    if (typeof message !== 'string') return;

    const attachment = ws.deserializeAttachment() as WSAttachment;
    const userSessions = await this.stateManager.get('userSessions');
    const user = userSessions.get(attachment.sessionId);
    if (!user) return;

    const data = JSON.parse(message) as ServerMessage;
    switch (data.type) {
      case 'start-game': {
        const gameState = await this.stateManager.get('gameState');
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
        await this.stateManager.put('gameState', startState);

        this.sendToAllClients({
          type: 'diff',
          diffs: [
            {
              type: 'state',
              state: startState,
            },
          ],
        });
        break;
      }
      case 'sync': {
        const gameState = await this.stateManager.get('gameState');
        this.sendToClient(ws, {
          type: 'sync',
          gameState,
          userState: serverToClientUserState(user),
          users: Array.from(userSessions.values()).map(serverToClientUserState),
        });
        break;
      }
      case 'clue': {
        const gameState = await this.stateManager.get('gameState');
        if (
          gameState.stage !== 'playing' ||
          user.team !== gameState.currentTeam
        )
          return;

        const { diffs, newGameState } = await generateGuesses(
          gameState,
          data.clue,
          data.modelId,
        );
        await this.stateManager.put('gameState', newGameState);

        this.sendToAllClients({
          type: 'diff',
          diffs: diffs,
        });
        break;
      }
      case 'switch-team': {
        const gameState = await this.stateManager.get('gameState');
        if (gameState.stage !== 'lobby') return;

        const newTeam = user.team === 'red' ? 'blue' : 'red';
        const newUser: ServerUserState = {
          ...user,
          team: newTeam,
        };
        userSessions.set(attachment.sessionId, newUser);
        await this.stateManager.put('userSessions', userSessions);

        this.sendToAllClients({
          type: 'player-state-change',
          userState: serverToClientUserState(newUser),
        });
        break;
      }
    }
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

    this.sendToAllClients({
      type: 'player-state-change',
      userState: serverToClientUserState(newUser),
    });
  }

  sendToClient(ws: WebSocket, message: ClientMessage) {
    const messageString = JSON.stringify(message);
    ws.send(messageString);
  }

  sendToAllClients(message: ClientMessage) {
    const messageString = JSON.stringify(message);
    for (const clientWS of this.ctx.getWebSockets())
      clientWS.send(messageString);
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

    this.sendToAllClients({
      type: 'player-state-change',
      userState: serverToClientUserState(user),
    });

    return sessionId;
  }
}

export default {
  async fetch(request, ...args): Promise<Response> {
    return baseRouter.fetch(request, ...args, request);
  },
} satisfies ExportedHandler<Env>;
