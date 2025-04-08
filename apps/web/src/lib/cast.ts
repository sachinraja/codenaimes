/** use as input parser when you trust server */
export function castParse<T>() {
  return (value: unknown): T => value as T;
}
