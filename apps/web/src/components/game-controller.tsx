'use client';

import { useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';
import type { ClientMessage, ServerMessage } from '@codenaimes/ws-interface';
import type { UserState, GameState } from '@codenaimes/game/types';
import { Lobby } from './lobby';
import Game from './game';
import { LoadingScreen } from './loading';
import type { Diff } from '@codenaimes/ws-interface/diff';

interface GameControllerProps {
  roomId: string;
}

export function GameController({ roomId }: GameControllerProps) {
  const socketURL = `ws://localhost:8787/room/${roomId}`;
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(socketURL);
  const [isLoading, setIsLoading] = useState(true);
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
        setIsLoading(false);
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
      {isLoading ? (
        <LoadingScreen />
      ) : (
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
              submitClue={(clue) => {
                const message: ServerMessage = { type: 'clue', clue };
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
