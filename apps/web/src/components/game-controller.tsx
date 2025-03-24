'use client';

import { useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';
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

  const socketURL = `${process.env.NEXT_PUBLIC_WORKERS_WS_URL}/room/${roomId}`;

  const { sendJsonMessage, lastJsonMessage } = useWebSocket(socketURL, {
    onError() {
      setStatus('error');
    },
  });

  const [gameState, setGameState] = useState<GameState>({
    stage: 'lobby',
    teamStateMap: {
      red: 'waiting',
      blue: 'waiting',
    },
  });
  const [userState, setUserState] = useState<UserState>({
    id: '',
    team: 'red',
  });
  const [diffs, setDiffs] = useState<Diff[]>([]);

  useEffect(() => {
    const message = lastJsonMessage as ClientMessage;
    if (!message) return;
    switch (message.type) {
      case 'sync': {
        setGameState(message.gameState);
        setUserState(message.userState);
        setStatus('ready');
        break;
      }
      case 'diff': {
        const stateDiff = message.diffs.find((diff) => diff.type === 'state');
        if (stateDiff) setGameState(stateDiff.state);
        setDiffs(message.diffs);
        break;
      }
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    sendJsonMessage({ type: 'sync' });
  }, [sendJsonMessage]);

  return (
    <>
      {status === 'loading' && <TextScreen>Loading...</TextScreen>}
      {status === 'error' && (
        <TextScreen>
          <p>Error connecting to server</p>
          <p>Room may not be created</p>
        </TextScreen>
      )}
      {status === 'ready' && (
        <>
          {gameState.stage === 'lobby' && (
            <Lobby
              startGame={() => {
                const message: ServerMessage = { type: 'start-game' };
                sendJsonMessage(message);
              }}
              gameState={gameState}
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
