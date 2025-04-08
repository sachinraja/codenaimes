import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

export const rpcClientRouter = t.router({
  sync: t.procedure.mutation(() => {
    setGameState(message.gameState);
    setUserState(message.userState);
    setUsers(message.users);
    setStatus('ready');
  }),
  diff: t.procedure.mutation(() => {
    const stateDiff = message.diffs.find((diff) => diff.type === 'state');
    if (stateDiff) setGameState(stateDiff.state);
    setDiffs(message.diffs);
  }),
});

export type RpcClientRouter = typeof rpcClientRouter;
