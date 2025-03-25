import { DurableObject } from 'cloudflare:workers';
import type { GameState, Team, UserState } from '@codenaimes/game/types';
import { parse, serialize } from 'cookie';
import { generateRandomBoard } from '@codenaimes/game/board';
import type { ClientMessage, ServerMessage } from '@codenaimes/ws-interface';
import { generateRoomId } from './room';
import { generateGuesses } from './guess';

const OBJECT_TTL_MS = 5 * 60 * 1000;

interface WSAttachment {
  sessionId: string;
}

type UserSessionMap = Map<string, UserState>;
function getUserState(
  request: Request,
  userSessions: UserSessionMap,
): UserState | null {
  const cookie = parse(request.headers.get('Cookie') ?? '');
  if (!cookie.sessionId) return null;
  return userSessions.get(cookie.sessionId) ?? null;
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
      this.state = state ?? {
        stage: 'lobby',
        teamStateMap: { red: 'waiting', blue: 'waiting' },
      };
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

    let user = getUserState(request, this.userSessions);
    if (!user && this.state.stage !== 'lobby')
      return new Response('Unauthorized', { status: 401 });

    if (!user) {
      const sessionId = crypto.randomUUID();
      const team: Team = this.userSessions.size % 2 === 0 ? 'red' : 'blue';

      user = { id: sessionId, team: team };
      this.userSessions.set(sessionId, user);
      if (this.state.stage === 'lobby') this.state.teamStateMap[team] = 'ready';

      await Promise.all([
        this.ctx.storage.put('userSessions', this.userSessions),
        this.ctx.storage.put('state', this.state),
      ]);

      res.headers.append(
        'Set-Cookie',
        serialize('sessionId', sessionId, {
          sameSite: 'none',
          httpOnly: true,
          secure: this.env.ENVIRONMENT === 'production',
        }),
      );

      this.sendToAllClients({
        type: 'diff',
        diffs: [
          {
            type: 'state',
            state: this.state,
          },
        ],
      });
    }

    this.ctx.acceptWebSocket(server);

    const attachment: WSAttachment = { sessionId: user.id };
    server.serializeAttachment(attachment);

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
          userState: user,
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
    }
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

  createRoom() {
    this.created = true;
    this.ctx.storage.put('created', true);
  }
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path === '/create-room') {
      const roomId = generateRoomId();
      const id = env.GAME_DURABLE_OBJECT.idFromName(roomId);
      const stub = env.GAME_DURABLE_OBJECT.get(id);
      await stub.createRoom();

      return new Response(JSON.stringify({ id: roomId }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (path.startsWith('/room/') && path.length > 6) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Durable Object expected Upgrade: websocket', {
          status: 426,
        });
      }

      const roomId = path.slice(6);
      const id = env.GAME_DURABLE_OBJECT.idFromName(roomId);
      const stub = env.GAME_DURABLE_OBJECT.get(id);

      return stub.fetch(request);
    }

    return new Response(JSON.stringify({ message: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;
