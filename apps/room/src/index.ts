import { DurableObject } from 'cloudflare:workers';
import type { Board, GameStage, GameState, Team } from '@codenaimes/game/types';
import { parse, serialize } from 'cookie';
import { generateRandomBoard } from '@codenaimes/game/board';
import type { ClientMessage, ServerMessage } from '@codenaimes/ws-interface';
import { generateRoomId } from './room';

interface UserState {
  id: string;
  team: Team;
}

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

export class RoomDurableObject extends DurableObject<Env> {
  userSessions: UserSessionMap;
  state: GameState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      const userSessions =
        await this.ctx.storage.get<UserSessionMap>('userSessions');
      this.userSessions = userSessions ?? new Map();

      const state = await this.ctx.storage.get<GameState>('state');
      this.state = state ?? {
        stage: 'lobby',
        teamStateMap: { red: 'waiting', blue: 'waiting' },
      };
    });
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const res = new Response(null, {
      status: 101,
      webSocket: client,
    });

    let user = getUserState(request, this.userSessions);
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
        serialize('sessionId', sessionId, { httpOnly: true }),
      );

      const message: ClientMessage = {
        type: 'player-join',
        team: user.team,
      };
      const messageString = JSON.stringify(message);
      for (const clientWS of this.ctx.getWebSockets())
        clientWS.send(messageString);
    }

    this.ctx.acceptWebSocket(server);

    const attachment: WSAttachment = { sessionId: user.id };
    server.serializeAttachment(attachment);

    return res;
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
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
        };
        await this.ctx.storage.put('state', this.state);

        const message: ClientMessage = {
          type: 'sync',
          state: this.state,
        };
        const messageString = JSON.stringify(message);
        for (const clientWS of this.ctx.getWebSockets()) {
          clientWS.send(messageString);
        }
        break;
      }
      case 'sync': {
        const message: ClientMessage = {
          type: 'sync',
          state: this.state,
        };
        const messageString = JSON.stringify(message);
        ws.send(messageString);
        return;
      }
    }
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
      const id = env.ROOM_DURABLE_OBJECT.idFromName(roomId);
      const stub = env.ROOM_DURABLE_OBJECT.get(id);

      return stub.fetch(request);
    }

    return new Response(JSON.stringify({ message: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;
