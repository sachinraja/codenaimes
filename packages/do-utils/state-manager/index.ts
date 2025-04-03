import type { DurableObjectState } from '@cloudflare/workers-types';

type Defaults<TState> = {
  [K in keyof TState]: () => TState[K];
};

export class StateManager<TState extends Record<string, unknown>> {
  private loadedState: Map<string, unknown>;
  private storage: DurableObjectStorage;
  private defaults: Defaults<TState>;

  constructor(storage: DurableObjectStorage, defaults: Defaults<TState>) {
    this.loadedState = new Map();
    this.storage = storage;
    this.defaults = defaults;
  }

  async get<TKeys extends (keyof TState & string)[]>(
    keys: TKeys,
  ): Promise<{
    [TKey in TKeys[number]]: TState[TKey];
  }>;
  async get<TKey extends keyof TState & string>(
    key: TKey,
  ): Promise<TState[TKey]>;
  async get(entry: (keyof TState & string) | (keyof TState & string)[]) {
    if (Array.isArray(entry)) {
      const keys = [...entry];
      // this is really a power set of all keys but not going to do that here
      const values = {} as TState;

      // get the values that are already loaded
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const value = this.loadedState.get(key);
        if (value !== undefined) {
          values[key] = value as TState[keyof TState & string];
          keys.splice(i, 1);
        }
      }

      // get the values that are stored
      const storedValues = await this.storage.get(keys);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const value = storedValues.get(key);
        if (value !== undefined) {
          values[key] = value as TState[keyof TState & string];
          this.loadedState.set(key, value);
          keys.splice(i, 1);
        }
      }

      // get the default values
      for (const key of keys) {
        const value = this.defaults[key]();
        values[key] = value;
        this.loadedState.set(key, value);
        // no need to persist the default values
      }

      return values;
    }

    // check if the state is already loaded
    const loadedValue = this.loadedState.get(entry);
    if (loadedValue !== undefined)
      return loadedValue as TState[keyof TState & string];

    // load the state from storage
    const storedValue = await this.storage.get(entry);
    if (storedValue !== undefined) {
      this.loadedState.set(entry, storedValue);
      return storedValue as TState[keyof TState & string];
    }

    return this.defaults[entry]() as TState[keyof TState & string];
  }

  async put(
    entries: Partial<Record<keyof TState & string, unknown>>,
  ): Promise<void>;
  async put<TKey extends keyof TState & string>(
    entry: TKey,
    value: TState[TKey],
  ): Promise<void>;
  async put(
    entry: string | Partial<Record<keyof TState & string, unknown>>,
    value?: unknown,
  ) {
    if (typeof entry === 'object') {
      const entries = Object.entries(entry);
      for (const [key, value] of entries) {
        this.loadedState.set(key, value);
      }
      return this.storage.put(entry);
    }

    this.loadedState.set(entry, value);
    return this.storage.put(entry, value);
  }

  async delete(keys: (keyof TState & string) | (keyof TState & string)[]) {
    if (Array.isArray(keys)) {
      for (const key of keys) {
        this.loadedState.delete(key);
      }
      return this.storage.delete(keys);
    }

    this.loadedState.delete(keys);
    return this.storage.delete(keys);
  }

  async deleteAll() {
    this.loadedState.clear();
    return this.storage.deleteAll();
  }
}

export function createStateManager<TState extends Record<string, unknown>>(
  storage: DurableObjectStorage,
  defaults: { [key in keyof TState]: () => TState[key] },
) {
  return new StateManager<TState>(storage, defaults);
}
