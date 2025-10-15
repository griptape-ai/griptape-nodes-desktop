import { Store } from './base-store'
import { PersistentStore } from './persistent-store'

export class InMemoryStore<T extends Record<string, any>> extends Store<T> {
  private data: Partial<T> = {}

  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.data[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
  }

  clear(): void {
    this.data = {}
  }

  has<K extends keyof T>(key: K): boolean {
    return key in this.data && this.data[key] !== undefined
  }

  getAll(): Partial<T> {
    return { ...this.data }
  }

  toPersistent(storeName: string, encrypted: boolean): PersistentStore<T> {
    const persistentStore = new PersistentStore<T>(storeName, encrypted)

    // Copy all data to the persistent store
    Object.entries(this.data).forEach(([key, value]) => {
      if (value !== undefined) {
        persistentStore.set(key as keyof T, value as T[keyof T])
      }
    })

    return persistentStore
  }
}
