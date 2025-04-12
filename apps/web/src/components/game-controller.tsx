'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lobby } from './lobby';
import Game from './game';
import { TextScreen } from './text-screen';
import { createWebSocketHandler } from '@do-utils/birpc/server';
import type { RpcRouter } from '@codenaimes/live-tools/rpc';
import { useRPCRouter } from '@codenaimes/client-router';
import {
  createWebSocketManager,
  type WebSocketManager,
} from '@do-utils/birpc/client';

interface GameControllerProps {
  roomId: string;
}

export function GameController({ roomId }: GameControllerProps) {
  const socketURL = `${process.env.NEXT_PUBLIC_WORKERS_WS_URL}/room/${roomId}`;

  const { router, gameState, diffs, status, userState, users } = useRPCRouter();
  const manager = useRef<WebSocketManager>(null);

  const webSocketHandler = useMemo(
    () =>
      createWebSocketHandler({
        createContext() {
          return {};
        },
        getWebSocketConnectionId() {
          return '1';
        },
        router,
      }),
    [router],
  );

  const client = useMemo(() => {
    return webSocketHandler.createClient<RpcRouter>();
  }, [webSocketHandler]);

  useEffect(() => {
    manager.current = createWebSocketManager({
      url: socketURL,
      onMessage(ws, ev) {
        const message = ev.data;
        console.log('client received message', message);
        webSocketHandler.webSocketMessage(ws, message);
      },
      onConnect(ws) {
        (async () => {
          await webSocketHandler.webSocketConnect(ws);
          client.send(ws, client.builder.sync.queryOptions());
        })();
      },
      onDisconnect(ws) {
        webSocketHandler.webSocketClose(ws);
      },
    });

    return () => manager.current?.close();
  }, [client, webSocketHandler, socketURL]);

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
              startGame={async () => {
                await client.call(
                  // biome-ignore lint/style/noNonNullAssertion: <explanation>
                  manager.current?.getWebSocket()!,
                  client.builder.startGame.mutationOptions(),
                );
              }}
              switchTeam={async () => {
                await client.call(
                  // biome-ignore lint/style/noNonNullAssertion: <explanation>
                  manager.current?.getWebSocket()!,
                  client.builder.switchTeam.mutationOptions(),
                );
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
                await client.call(
                  // biome-ignore lint/style/noNonNullAssertion: <explanation>
                  manager.current?.getWebSocket()!,
                  client.builder.clue.mutationOptions({
                    clue,
                    modelId,
                  }),
                );
              }}
              diffs={diffs}
            />
          )}
        </>
      )}
    </>
  );
}
