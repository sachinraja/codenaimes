interface Model {
  name: string;
  id: string;
}

export const models = [
  {
    name: 'Gemini Flash 2.0',
    id: 'gemini-flash-2.0',
  },
  {
    name: 'GPT-4o mini',
    id: 'gpt-4o-mini',
  },
  {
    name: 'Llama 3.3 70b',
    id: 'llama-3.3-70b-instruct',
  },
  {
    name: 'Claude 3.5 Haiku',
    id: 'claude-3.5-haiku',
  },
] as const satisfies Model[];

export type ModelId = (typeof models)[number]['id'];
