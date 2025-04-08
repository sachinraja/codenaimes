import type {
  TRPCCombinedDataTransformer,
  TRPCProcedureType,
} from '@trpc/server';
import {
  isObject,
  procedureTypes,
} from '@trpc/server/unstable-core-do-not-import';
import type { TRPCRequestMessage, TRPCResponseMessage } from '@trpc/server/rpc';

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

export function parseMessage(
  obj: unknown,
  transformer: TRPCCombinedDataTransformer,
): RequestMessage | ResponseMessage {
  assertIsObject(obj);

  const { id, jsonrpc, method, params } = obj;
  assertIsRequestId(id);
  assertIsJSONRPC2OrUndefined(jsonrpc);
  assertIsProcedureType(method);

  if ('method' in obj) {
    assertIsObject(params);
    const { input: rawInput, path } = params;

    assertIsString(path);

    const input = transformer.input.deserialize(rawInput);

    return {
      type: 'request',
      id,
      jsonrpc,
      method,
      input,
      path,
    };
  }

  if ('error' in obj) {
    assertIsObject(obj.error);

    const error = transformer.output.deserialize(obj.error);
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

  if ('result' in obj) {
    assertIsObject(obj.result);

    return {
      type: 'response',
      id,
      jsonrpc,
      result: {
        type: 'data',
        data: transformer.output.deserialize(obj.result.data),
      },
    };
  }

  throw new Error('Unable to transform request/response');
}
