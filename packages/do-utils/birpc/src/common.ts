export type RPCHandlerMap = Map<
  string | number,
  { resolve: (value: unknown) => void; reject: (reason?: any) => void }
>;

export type WebSocketRPCHandlerMap = Map<string, RPCHandlerMap>;
