import type {
  TRPCCombinedDataTransformer,
  TRPCProcedureType,
} from '@trpc/server';
import {
  isObject,
  type JSONRPC2,
  procedureTypes,
} from '@trpc/server/unstable-core-do-not-import';

/* istanbul ignore next -- @preserve */
function assertIsObject(obj: unknown): asserts obj is Record<string, unknown> {
  if (!isObject(obj)) {
    throw new Error('Not an object');
  }
}

/* istanbul ignore next -- @preserve */
function assertIsProcedureType(obj: unknown): asserts obj is TRPCProcedureType {
  if (!procedureTypes.includes(obj as any)) {
    throw new Error('Invalid procedure type');
  }
}

/* istanbul ignore next -- @preserve */
function assertIsRequestId(
  obj: unknown,
): asserts obj is number | string | null {
  if (
    obj !== null &&
    typeof obj === 'number' &&
    Number.isNaN(obj) &&
    typeof obj !== 'string'
  ) {
    throw new Error('Invalid request id');
  }
}

/* istanbul ignore next -- @preserve */
function assertIsString(obj: unknown): asserts obj is string {
  if (typeof obj !== 'string') {
    throw new Error('Invalid string');
  }
}

/* istanbul ignore next -- @preserve */
function assertIsJSONRPC2OrUndefined(
  obj: unknown,
): asserts obj is '2.0' | undefined {
  if (typeof obj !== 'undefined' && obj !== '2.0') {
    throw new Error('Must be JSONRPC 2.0');
  }
}

interface BaseMessage {
  id: number | string | null;
  jsonrpc: '2.0' | undefined;
}

export interface RequestMessage extends BaseMessage {
  type: 'request';
  method: TRPCProcedureType;
  input: unknown;
  path: string;
}

export interface ResponseMessage extends BaseMessage {
  type: 'response';
  result:
    | {
        type: 'data';
        data: unknown;
      }
    | {
        type: 'error';
        error: unknown;
      };
}

export function parseBaseEnvelope(message: unknown) {
  assertIsObject(message);

  const { id, jsonrpc } = message;

  assertIsRequestId(id);
  assertIsJSONRPC2OrUndefined(jsonrpc);

  return {
    ...message,
    id,
    jsonrpc,
  };
}

type BaseEnvelope = ReturnType<typeof parseBaseEnvelope>;

export function parseRequestMessage(
  message: BaseEnvelope,
  transformer: TRPCCombinedDataTransformer,
): RequestMessage | null {
  if (!('method' in message)) {
    return null;
  }

  const method = message.method;
  assertIsProcedureType(method);

  if (!('params' in message)) {
    throw new Error('No params in message');
  }

  assertIsObject(message.params);
  const { input: rawInput, path } = message.params;

  assertIsString(path);

  const input = transformer.input.deserialize(rawInput);

  return {
    type: 'request',
    id: message.id,
    jsonrpc: message.jsonrpc,
    method,
    input,
    path,
  };
}

export function parseResponseMessage(
  message: BaseEnvelope,
  transformer: TRPCCombinedDataTransformer,
): ResponseMessage | null {
  const { id, jsonrpc } = message;

  if ('error' in message) {
    assertIsObject(message.error);

    const error = transformer.output.deserialize(message.error);
    assertIsObject(error);

    if (typeof error.code !== 'number') throw new Error('Invalid error code');

    return {
      type: 'response',
      id,
      jsonrpc,
      result: {
        type: 'error',
        error,
      },
    };
  }

  if ('result' in message) {
    assertIsObject(message.result);

    return {
      type: 'response',
      id,
      jsonrpc,
      result: {
        type: 'data',
        data: transformer.output.deserialize(message.result.data),
      },
    };
  }

  return null;
}

export function parseMessage({
  message: rawMessage,
  requestTransformer,
  responseTransformer,
}: {
  message: unknown;
  requestTransformer: TRPCCombinedDataTransformer;
  responseTransformer: TRPCCombinedDataTransformer;
}): RequestMessage | ResponseMessage {
  const message = parseBaseEnvelope(rawMessage);

  const requestMessage = parseRequestMessage(message, requestTransformer);
  if (requestMessage) return requestMessage;

  const responseMessage = parseResponseMessage(message, responseTransformer);
  if (responseMessage) return responseMessage;

  throw new Error('Unable to transform request/response');
}
