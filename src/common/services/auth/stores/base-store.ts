export abstract class Store<T extends Record<string, any>> {
  abstract get<K extends keyof T>(key: K): T[K] | undefined;
  abstract set<K extends keyof T>(key: K, value: T[K]): void;
  abstract clear(): void;
  abstract has<K extends keyof T>(key: K): boolean;
  abstract getAll(): Partial<T>;
}
