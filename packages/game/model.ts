interface Model {
  name: string;
  id: string;
}

export const models = [
  {
    name: 'Gemini Flash 1.5',
    id: 'gemini-flash-1.5',
  },
  {
    name: 'GPT-4o mini',
    id: 'gpt-4o-mini',
  },
] as const satisfies Model[];

export type ModelId = (typeof models)[number]['id'];
