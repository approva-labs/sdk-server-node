// src/storage/FileStorageAdapter.ts

import { promises as fs } from "node:fs";
import path from "node:path";

import type { StorageAdapter } from "./StorageAdapter.js";

interface Entry<T> {
  value: T;
  expiresAt?: number;
}

type StorageData = Record<string, Entry<unknown>>;

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly filePath: string;

  /**
   * Prevents multiple initialization calls
   * within the same process.
   */
  private initialized = false;

  /**
   * Ensures writes happen sequentially.
   *
   * This prevents two concurrent set/delete operations
   * from reading the same old file and overwriting
   * each other's changes.
   */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath = "./data/approva-storage.json") {
    this.filePath = path.resolve(filePath);
  }

  /**
   * Initialize the storage file.
   *
   * IMPORTANT:
   * If the file already exists, it is NEVER overwritten.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(path.dirname(this.filePath), {
      recursive: true,
    });

    try {
      await fs.access(this.filePath);
    } catch {
      /**
       * Only create the file when it does not exist.
       */
      await fs.writeFile(this.filePath, JSON.stringify({}, null, 2), "utf8");
    }

    this.initialized = true;
  }

  /**
   * Read the complete storage file.
   *
   * This method NEVER removes records.
   */
  private async readStore(): Promise<StorageData> {
    await this.initialize();

    const content = await fs.readFile(this.filePath, "utf8");

    if (!content.trim()) {
      return {};
    }

    try {
      return JSON.parse(content) as StorageData;
    } catch (error) {
      throw new Error(
        `Failed to parse Approva storage file: ${this.filePath}`,
        {
          cause: error,
        }
      );
    }
  }

  /**
   * Write the complete storage file.
   */
  private async writeStore(store: StorageData): Promise<void> {
    await this.initialize();

    /**
     * Write to a temporary file first and then
     * replace the original file.
     *
     * This reduces the chance of leaving a corrupted
     * JSON file if the process is interrupted while
     * writing.
     */
    const temporaryFile = `${this.filePath}.tmp`;

    await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2), "utf8");

    await fs.rename(temporaryFile, this.filePath);
  }

  /**
   * Execute writes sequentially.
   *
   * This is important because multiple asynchronous
   * requests can call set/delete at the same time.
   */
  private async queueWrite(operation: () => Promise<void>): Promise<void> {
    const next = this.writeQueue.then(operation);

    this.writeQueue = next.catch(() => undefined);

    await next;
  }

  /**
   * Get a value.
   *
   * IMPORTANT:
   * Expired records are NOT deleted automatically.
   *
   * expiresAt is returned as part of the stored entry
   * only internally; the public API returns the value.
   */
  async get<T>(key: string): Promise<T | null> {
    const store = await this.readStore();

    const entry = store[key];

    if (!entry) {
      return null;
    }

    /**
     * Do not delete expired records.
     *
     * The record remains persisted across restarts.
     */
    return entry.value as T;
  }

  /**
   * Create or update a record.
   *
   * Existing records are preserved.
   *
   * Calling set() for one key only changes that key;
   * every other stored record remains untouched.
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.queueWrite(async () => {
      const store = await this.readStore();

      store[key] = {
        value,
        ...(ttlMs !== undefined
          ? {
              expiresAt: Date.now() + ttlMs,
            }
          : {}),
      };

      await this.writeStore(store);
    });
  }

  /**
   * Explicitly delete a record.
   *
   * Records are only removed when the application
   * explicitly calls delete().
   */
  async delete(key: string): Promise<void> {
    await this.queueWrite(async () => {
      const store = await this.readStore();

      if (!(key in store)) {
        return;
      }

      delete store[key];

      await this.writeStore(store);
    });
  }

  /**
   * List all records matching a prefix.
   *
   * IMPORTANT:
   * Expired records are still returned.
   *
   * Nothing is automatically removed from storage.
   */
  async list<T>(prefix: string): Promise<T[]> {
    const store = await this.readStore();

    const results: T[] = [];

    for (const [key, entry] of Object.entries(store)) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      results.push(entry.value as T);
    }

    return results;
  }
}
