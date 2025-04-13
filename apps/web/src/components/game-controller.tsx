'use client';

import { useEffect, useState } from 'react';
import { Lobby } from './lobby';
import Game from './game';
import { TextScreen } from './text-screen';
import {
  createBirpc,
  createWebSocketClient,
  createWebSocketHandler,
  type ManagedClient,
} from '@do-utils/birpc';
import type { RPCRouter } from '@codenaimes/live-tools/rpc';
import { useRPCRouter } from '@codenaimes/client-router';
import { toast } from 'sonner';

interface GameControllerProps {
  roomId: string;
  sessionId: string;
}

export function GameController({ roomId, sessionId }: GameControllerProps) {
  const socketURL = `${process.env.NEXT_PUBLIC_WORKERS_WS_URL}/room/${roomId}?sessionId=${encodeURIComponent(sessionId)}`;

  const { router, gameState, diffs, status, setStatus, userState, users } =
    useRPCRouter();
  const [c, setManagedClient] = useState<ManagedClient<RPCRouter> | null>(null);

  useEffect(() => {
    const handler = createWebSocketHandler({
      createContext() {
        return {};
      },
      router,
    });

    const client = createWebSocketClient<RPCRouter>({
      getConnectionId: () => '1',
    });

    const { manager, managedClient } = createBirpc({
      handler,
      client,
      url: socketURL,
      onOpen(ws) {
        setStatus('loading');
        client.send(ws, client.builder.sync.queryOptions());
      },
      onError() {
        setStatus('error');
      },
    });

    setManagedClient(managedClient);

    return () => manager.close();
  }, [router, socketURL, setStatus]);

  return (
    <>
      {status === 'loading' && <TextScreen>Loading...</TextScreen>}
      {status === 'error' && (
        <TextScreen>
          <p>Error. You may be unauthorized.</p>
          <p>Have you joined the room?</p>
        </TextScreen>
      )}
      {status === 'ready' && gameState && userState && (
        <>
          {gameState.stage === 'lobby' && (
            <Lobby
              startGame={() => {
                c?.send(c.builder.startGame.mutationOptions());
              }}
              switchTeam={() => {
                c?.send(c.builder.switchTeam.mutationOptions());
              }}
              users={users}
            />
          )}
          {(gameState.stage === 'playing' ||
            gameState.stage === 'complete') && (
            <Game
              userState={userState}
              gameState={gameState}
              submitClue={async (input) => {
                try {
                  await c?.call(c.builder.giveClue.mutationOptions(input));
                } catch (e) {
                  console.error(e);
                  toast.error('Error submitting clue. Please try again.');
                }
              }}
              diffs={diffs}
              users={users}
            />
          )}
        </>
      )}
    </>
  );
}
