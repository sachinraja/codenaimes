import { AutoRouter, cors, json, type IRequest } from 'itty-router';
import { generateRoomId } from '../room';
import { serialize } from 'cookie';
import { z } from 'zod';
import type { UserState } from '@codenaimes/game/types';

const { preflight, corsify } = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  credentials: true,
  maxAge: 86400,
});

type CFArgs = [Env, ExecutionContext, Request];

const baseRouter = AutoRouter<IRequest, CFArgs>({
  before: [preflight],
  finally: [corsify],
});

const joinRoomSchema = z.object({
  username: z.string(),
});

function userCookieHeader(sessionId: string) {
  return serialize('sessionId', sessionId, {
    sameSite: 'none',
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 7 /* 7 days */,
  });
}

baseRouter.post('/create-room', async (req, env) => {
  const body = await req.json();
  const result = joinRoomSchema.safeParse(body);
  if (!result.success) {
    return new Response('Invalid request', {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const roomId = generateRoomId();
  const id = env.GAME_DURABLE_OBJECT.idFromName(roomId);
  const stub = env.GAME_DURABLE_OBJECT.get(id);

  const { username } = result.data;
  const sessionId = await stub.createRoom(username);

  return json(
    { id: roomId },
    {
      headers: {
        'Set-Cookie': userCookieHeader(sessionId),
      },
    },
  );
});

baseRouter.get('/room/:roomId', (req, env, _ctx, originalReq) => {
  const upgradeHeader = req.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Durable Object expected Upgrade: websocket', {
      status: 426,
    });
  }

  const roomId = req.params.roomId;
  const id = env.GAME_DURABLE_OBJECT.idFromName(roomId);
  const stub = env.GAME_DURABLE_OBJECT.get(id);

  return stub.fetch(originalReq);
});

baseRouter.post('/room/:roomId/join', async (req, env) => {
  const body = await req.json();
  const result = joinRoomSchema.safeParse(body);
  if (!result.success) {
    return new Response('Invalid request', {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const roomId = req.params.roomId;
  const id = env.GAME_DURABLE_OBJECT.idFromName(roomId);
  const stub = env.GAME_DURABLE_OBJECT.get(id);

  const { username } = result.data;
  const sessionId = await stub.createUser(username);

  return new Response(null, {
    status: 200,
    headers: {
      'Set-Cookie': userCookieHeader(sessionId),
    },
  });
});

export { baseRouter };
