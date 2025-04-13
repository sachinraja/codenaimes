import type { GameState, UserState } from '@codenaimes/game/types';
import type { Diff } from '@codenaimes/game/diff';
import { initTRPC } from '@trpc/server';
import { useMemo, useRef, useState } from 'react';
import { castParse } from './cast';

type Status = 'loading' | 'error' | 'ready';

export function useRPCRouter() {
  const [status, setStatus] = useState<Status>('loading');
  const [users, setUsers] = useState<UserState[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const userStateRef = useRef<UserState | null>(null);
  const [diffs, setDiffs] = useState<Diff[]>([]);

  const router = useMemo(() => {
    const t = initTRPC.create({ allowOutsideOfServer: true });

    return t.router({
      sync: t.procedure
        .input(
          castParse<{
            gameState: GameState;
            userState: UserState;
            users: UserState[];
          }>(),
        )
        .mutation(({ input }) => {
          setGameState(input.gameState);
          setUserState(input.userState);
          userStateRef.current = input.userState;
          setUsers(input.users);
          setStatus('ready');
        }),
      createDiffs: t.procedure
        .input(
          castParse<{
            diffs: Diff[];
          }>(),
        )
        .mutation(({ input }) => {
          const stateDiff = input.diffs.find((diff) => diff.type === 'state');
          if (stateDiff) setGameState(stateDiff.state);
          setDiffs(input.diffs);
        }),
      changePlayerState: t.procedure
        .input(
          castParse<{
            userState: UserState;
          }>(),
        )
        .mutation(({ input }) => {
          const { userState: changedUserState } = input;
          if (
            userStateRef.current &&
            userStateRef.current.id === changedUserState.id
          ) {
            userStateRef.current = changedUserState;
            setUserState(changedUserState);
          }

          setUsers((prevUsers) => {
            const newUsers = [...prevUsers];
            const changedUserIndex = newUsers.findIndex(
              (user) => user.id === changedUserState.id,
            );
            if (changedUserIndex !== -1) {
              newUsers[changedUserIndex] = changedUserState;
              return newUsers;
            }
            newUsers.push(changedUserState);
            return newUsers;
          });
        }),
    });
  }, []);

  return {
    router,
    status,
    setStatus,
    gameState,
    userState,
    users,
    diffs,
  };
}

export type RpcClientRouter = ReturnType<typeof useRPCRouter>['router'];
