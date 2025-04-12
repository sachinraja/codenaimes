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
}

export function GameController({ roomId }: GameControllerProps) {
  const socketURL = `${process.env.NEXT_PUBLIC_WORKERS_WS_URL}/room/${roomId}`;

  const { router, gameState, diffs, status, userState, users } = useRPCRouter();
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
        client.send(ws, client.builder.sync.queryOptions());
      },
    });

    setManagedClient(managedClient);

    return () => manager.close();
  }, [router, socketURL]);

  return (
    <>
      {status === 'loading' && <TextScreen>Loading...</TextScreen>}
      {status === 'error' && (
        <TextScreen>
          <p>Error connecting to server</p>
          <p>Room may not be created</p>
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
              submitClue={async (clue, modelId) => {
                try {
                  await c?.call(
                    c.builder.clue.mutationOptions({
                      clue,
                      modelId,
                    }),
                  );
                } catch {
                  toast.error('Error submitting clue. Please try again.');
                }
              }}
              diffs={diffs}
            />
          )}
        </>
      )}
    </>
  );
}
