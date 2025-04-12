export interface WSAttachment {
  sessionId: string;
}

export function isWSAttachment(
  attachment: unknown,
): attachment is WSAttachment {
  return (
    typeof attachment === 'object' &&
    attachment !== null &&
    'sessionId' in attachment &&
    typeof attachment.sessionId === 'string'
  );
}
