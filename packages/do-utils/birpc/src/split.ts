import { TRPCError, type AnyTRPCRouter } from '@trpc/server';
import type { WebSocketClient } from './client';
import type { CreateWebSocketManagerOptions } from './manager';
import { parseMessage } from './parse';
import type { WebSocketHandler } from './server';

export const splitOnMessage = ({
  handler,
  client,
}: {
  handler: WebSocketHandler;
  client: WebSocketClient<AnyTRPCRouter>;
}): Exclude<CreateWebSocketManagerOptions['onMessage'], undefined> => {
  return (ws, ev) => {
    const message = ev.data;

    const messageStr = message.toString();
    const messageJSON = JSON.parse(messageStr);

    const messages = Array.isArray(messageJSON) ? messageJSON : [messageJSON];

    for (const message of messages) {
      try {
        const parsedMessage = parseMessage({
          message,
          requestTransformer: handler._internal.transformer,
          responseTransformer: client._internal.transformer,
        });

        if (parsedMessage.type === 'request') {
          handler._internal.onMessage(ws, parsedMessage);
        } else {
          client._internal.onMessage(ws, parsedMessage);
        }
      } catch (cause) {
        throw new Error('Received invalid message', { cause });
      }
    }
  };
};
