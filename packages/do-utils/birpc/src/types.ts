export type OnOpen = (ws: WebSocket) => Promise<void>;
export type OnClose = (ws: WebSocket) => Promise<void>;
export type OnMessage = (
  ws: WebSocket,
  message: string | ArrayBuffer,
) => Promise<void>;
