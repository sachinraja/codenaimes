import { type AnyTRPCRouter, transformTRPCResponse } from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';

export function getResponder(router: AnyTRPCRouter) {
  return (ws: WebSocket, untransformedJSON: TRPCResponseMessage) => {
    ws.send(
      JSON.stringify(
        transformTRPCResponse(router._def._config, untransformedJSON),
      ),
    );
  };
}
