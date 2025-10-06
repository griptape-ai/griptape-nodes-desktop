import { EventEmitter } from 'node:events';
import { safeStorage } from 'electron';
import ElectronStore from 'electron-store';
import * as fs from 'fs';
import { Store } from './base-store';
import { logger } from '@/main/utils/logger';

export class PersistentStore<T extends Record<string, any>> extends Store<T> {
  private electronStore: any;
  private encrypted: boolean;
  private emitter: EventEmitter;

  constructor(storeName: string, encrypted: boolean) {
    super();
    this.encrypted = encrypted;
    this.emitter = new EventEmitter();
    this.electronStore = new ElectronStore<T>({
      name: storeName,
    });

    // Set up change listeners
    this.electronStore.onDidAnyChange((newValue: T, oldValue: T) => {
      // Emit decrypted values for apiKey changes if encrypted
      if (this.encrypted && 'apiKey' in newValue && 'apiKey' in oldValue) {
        const newApiKey = newValue.apiKey as string | undefined;
        const oldApiKey = oldValue.apiKey as string | undefined;

        if (newApiKey !== oldApiKey && newApiKey && typeof newApiKey === 'string') {
          const decrypted = this.decryptValue(newApiKey);
          this.emitter.emit('change:apiKey', decrypted);
        }
      }
    });
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    const value = this.electronStore.get(key as string);

    // Decrypt apiKey if encrypted
    if (this.encrypted && key === 'apiKey' && typeof value === 'string') {
      return this.decryptValue(value) as T[K];
    }

    return value;
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    // Encrypt apiKey if encrypted mode is enabled
    if (this.encrypted && key === 'apiKey' && typeof value === 'string') {
      const encrypted = this.encryptValue(value);
      this.electronStore.set(key as string, encrypted as T[K]);
    } else {
      this.electronStore.set(key as string, value);
    }
  }

  clear(): void {
    this.electronStore.clear();
  }

  deleteStore(): void {
    try {
      // Clear the store contents first
      this.clear();

      // Get the path to the store file and delete it
      const storePath = this.electronStore.path;
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
        logger.info('PersistentStore: Deleted store file at', storePath);
      }
    } catch (error) {
      logger.error('PersistentStore: Failed to delete store file:', error);
      throw error;
    }
  }

  has<K extends keyof T>(key: K): boolean {
    return this.electronStore.has(key as string);
  }

  getAll(): Partial<T> {
    const store = this.electronStore.store;
    const result: Partial<T> = {};

    // Decrypt apiKey if present and encrypted
    Object.entries(store).forEach(([key, value]) => {
      if (this.encrypted && key === 'apiKey' && typeof value === 'string') {
        result[key as keyof T] = this.decryptValue(value) as T[keyof T];
      } else {
        result[key as keyof T] = value as T[keyof T];
      }
    });

    return result;
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void): void {
    this.emitter.once(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  private encryptValue(value: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('PersistentStore: Encryption not available, storing unencrypted');
      return value;
    }
    try {
      const encrypted = safeStorage.encryptString(value);
      return encrypted.toString('hex');
    } catch (error) {
      logger.error('PersistentStore: Encryption failed:', error);
      return value;
    }
  }

  private decryptValue(encryptedHex: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('PersistentStore: Decryption not available, returning as-is');
      return encryptedHex;
    }
    try {
      const buffer = Buffer.from(encryptedHex, 'hex');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logger.warn('PersistentStore: Decryption failed, assuming unencrypted value');
      return encryptedHex;
    }
  }
}
