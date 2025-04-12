'use server';

import { cookies } from 'next/headers';

async function setUserCookieHeader(sessionId: string) {
  const cookieStore = await cookies();
  return cookieStore.set('sessionId', sessionId, {
    secure: true,
    maxAge: 60 * 60 * 24 * 7 /* 7 days */,
  });
}

export async function createRoom(username: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_WORKERS_HTTP_URL}/create-room`,
    {
      body: JSON.stringify({ username }),
      method: 'POST',
    },
  );

  const data = (await res.json()) as {
    roomId: string;
    sessionId: string;
  };

  await setUserCookieHeader(data.sessionId);

  return data.roomId;
}

export async function joinRoom(roomId: string, username: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_WORKERS_HTTP_URL}/room/${roomId}/join`,
    {
      body: JSON.stringify({ username }),
      method: 'POST',
      credentials: 'include',
    },
  );

  const data = (await res.json()) as {
    sessionId: string;
  };

  await setUserCookieHeader(data.sessionId);
}
