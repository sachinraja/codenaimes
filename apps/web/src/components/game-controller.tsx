'use client';

import { useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';
import type { ClientMessage, ServerMessage } from '@codenaimes/ws-interface';
import type { GameState } from '@codenaimes/game/types';
import { Lobby, type LobbyProps } from './lobby';
import Game from './game';
import { LoadingScreen } from './loading';

interface GameControllerProps {
  roomId: string;
}

export function GameController({ roomId }: GameControllerProps) {
  const socketURL = `ws://localhost:8787/room/${roomId}`;
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(socketURL);
  const [isLoading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>({ stage: 'lobby' });
  const [teamStateMap, setTeamStateMap] = useState<LobbyProps['teamStateMap']>({
    red: 'waiting',
    blue: 'waiting',
  });

  useEffect(() => {
    const message = lastJsonMessage as ClientMessage;
    if (!message) return;
    switch (message.type) {
      case 'player-join': {
        setTeamStateMap((teamStateMap) => ({
          ...teamStateMap,
          [message.team]: 'ready',
        }));
        break;
      }
      case 'sync': {
        switch (message.state.stage) {
          case 'lobby': {
            setTeamStateMap(message.state.teamStateMap);
            break;
          }
          case 'playing': {
            setGameState({
              stage: 'playing',
              currentTeam: message.state.currentTeam,
            });
            break;
          }
          case 'complete': {
            setGameState({
              stage: 'complete',
              winner: message.state.winner,
            });
            break;
          }
        }

        setLoading(false);
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
              teamStateMap={teamStateMap}
            />
          )}
          {gameState.stage === 'playing' && <Game />}
          {gameState.stage === 'complete' && <Game />}
        </>
      )}
    </>
  );
}
