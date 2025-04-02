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

const OBJECT_TTL_MS = 5 * 60 * 1000;

interface WSAttachment {
  sessionId: string;
}

export class GameDurableObject extends DurableObject<Env> {
  userSessions: UserSessionMap;
  state: GameState;
  created: boolean;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      const [userSessions, state, created] = await Promise.all([
        this.ctx.storage.get<UserSessionMap>('userSessions'),
        this.ctx.storage.get<GameState>('state'),
        this.ctx.storage.get<boolean>('created'),
        this.resetTTL(),
      ]);

      this.userSessions = userSessions ?? new Map();
      this.state = state ?? { stage: 'lobby' };
      this.created = created ?? false;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.created) return new Response('Not found', { status: 404 });
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
    const user = this.userSessions.get(sessionId);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    this.ctx.acceptWebSocket(server);

    const newUser: ServerUserState = {
      ...user,
      connections: user.connections + 1,
    };
    this.userSessions.set(sessionId, newUser);
    await this.ctx.storage.put('userSessions', this.userSessions);

    const attachment: WSAttachment = { sessionId: sessionId };
    server.serializeAttachment(attachment);

    this.sendToAllClients({
      type: 'player-state-change',
      userState: serverToClientUserState(newUser),
    });

    return res;
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    await this.resetTTL();
    if (typeof message !== 'string') return;

    const attachment = ws.deserializeAttachment() as WSAttachment;
    const user = this.userSessions.get(attachment.sessionId);
    if (!user) return;

    const data = JSON.parse(message) as ServerMessage;
    switch (data.type) {
      case 'start-game': {
        if (
          this.state.stage !== 'lobby' ||
          !canGameStart(Array.from(this.userSessions.values()))
        )
          return;

        this.state = {
          stage: 'playing',
          board: generateRandomBoard(),
          currentTeam: 'red',
          clues: {
            red: [],
            blue: [],
          },
        };
        await this.ctx.storage.put('state', this.state);

        this.sendToAllClients({
          type: 'diff',
          diffs: [
            {
              type: 'state',
              state: this.state,
            },
          ],
        });
        break;
      }
      case 'sync': {
        this.sendToClient(ws, {
          type: 'sync',
          gameState: this.state,
          userState: serverToClientUserState(user),
          users: Array.from(this.userSessions.values()).map(
            serverToClientUserState,
          ),
        });
        break;
      }
      case 'clue': {
        if (
          this.state.stage !== 'playing' ||
          user.team !== this.state.currentTeam
        )
          return;

        const { diffs, newState } = await generateGuesses(
          this.state,
          data.clue,
          data.modelId,
        );
        this.state = newState;
        await this.ctx.storage.put('state', this.state);

        this.sendToAllClients({
          type: 'diff',
          diffs: diffs,
        });
        break;
      }
      case 'switch-team': {
        if (this.state.stage !== 'lobby') return;

        const newTeam = user.team === 'red' ? 'blue' : 'red';
        const newUser: ServerUserState = {
          ...user,
          team: newTeam,
        };
        this.userSessions.set(attachment.sessionId, newUser);
        await this.ctx.storage.put('userSessions', this.userSessions);

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
    const user = this.userSessions.get(attachment.sessionId);
    if (!user) return;

    const newUser: ServerUserState = {
      ...user,
      connections: user.connections - 1,
    };
    this.userSessions.set(attachment.sessionId, newUser);
    await this.ctx.storage.put('userSessions', this.userSessions);

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
    this.created = true;
    await this.ctx.storage.put('created', true);

    return this.createUser(username);
  }

  async createUser(username: string) {
    const team: Team = this.userSessions.size % 2 === 0 ? 'red' : 'blue';

    const user: ServerUserState = {
      id: crypto.randomUUID(),
      team: team,
      username: username,
      connections: 0,
    };

    const sessionId = crypto.randomUUID();
    this.userSessions.set(sessionId, user);
    await this.ctx.storage.put('userSessions', this.userSessions);

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
