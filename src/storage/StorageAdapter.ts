// file: src/storage/StorageAdapter.ts
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
}

//[x] improve all file locations
