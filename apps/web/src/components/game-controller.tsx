'use client';

import { useEffect, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import type { ClientMessage, ServerMessage } from '@codenaimes/ws-interface';
import type { UserState, GameState } from '@codenaimes/game/types';
import { Lobby } from './lobby';
import Game from './game';
import { TextScreen } from './text-screen';
import type { Diff } from '@codenaimes/ws-interface/diff';

interface GameControllerProps {
  roomId: string;
}

type Status = 'loading' | 'error' | 'ready';

export function GameController({ roomId }: GameControllerProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [users, setUsers] = useState<UserState[]>([]);

  const socketURL = `${process.env.NEXT_PUBLIC_WORKERS_WS_URL}/room/${roomId}`;

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    socketURL,
    {
      onError() {
        setStatus('error');
      },
    },
  );

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [diffs, setDiffs] = useState<Diff[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we must only run this when we receive a new message
  useEffect(() => {
    const message = lastJsonMessage as ClientMessage;
    if (!message) return;
    switch (message.type) {
      case 'sync': {
        setGameState(message.gameState);
        setUserState(message.userState);
        setUsers(message.users);
        setStatus('ready');
        break;
      }
      case 'diff': {
        const stateDiff = message.diffs.find((diff) => diff.type === 'state');
        if (stateDiff) setGameState(stateDiff.state);
        setDiffs(message.diffs);
        break;
      }
      case 'player-state-change': {
        const { userState: changedUserState } = message;
        if (userState && userState.id === changedUserState.id) {
          setUserState(changedUserState);
        }

        setUsers((prevUsers) => {
          const newUsers = prevUsers.filter(
            (user) => user.id !== changedUserState.id,
          );
          newUsers.push(changedUserState);
          return newUsers;
        });
        break;
      }
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    sendJsonMessage({ type: 'sync' });
  }, [sendJsonMessage, readyState]);

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
                const message: ServerMessage = { type: 'start-game' };
                sendJsonMessage(message);
              }}
              switchTeam={() => {
                const message: ServerMessage = { type: 'switch-team' };
                sendJsonMessage(message);
              }}
              users={users}
            />
          )}
          {(gameState.stage === 'playing' ||
            gameState.stage === 'complete') && (
            <Game
              userState={userState}
              gameState={gameState}
              submitClue={(clue, modelId) => {
                const message: ServerMessage = { type: 'clue', clue, modelId };
                sendJsonMessage(message);
              }}
              diffs={diffs}
            />
          )}
        </>
      )}
    </>
  );
}
