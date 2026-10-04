import type { StorageAdapter } from "../storage/StorageAdapter.js";

import type { StoredSession, SessionStatus } from "./types.js";

import { sessionKey, sessionPrefix } from "./session.keys.js";

export interface CreateStoredSessionInput {
  id: string;
  appId: string;
  userId?: string;
  origin: string;
  scopes: string[];
  status: SessionStatus;
  challenge: string;
  deepLink: string;
  createdAt: Date;
  expiresAt: Date;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  status?: SessionStatus;
  deepLink?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}

export class SessionRepository {
  constructor(private readonly storage: StorageAdapter) {}

  async create(input: CreateStoredSessionInput): Promise<StoredSession> {
    const session: StoredSession = {
      id: input.id,
      appId: input.appId,
      userId: input.userId,
      origin: input.origin,
      scopes: [...input.scopes],
      status: input.status,
      challenge: input.challenge,
      deepLink: input.deepLink,
      createdAt: input.createdAt.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
      deviceId: input.deviceId,
      metadata: input.metadata,
    };

    const ttlMs = Math.max(input.expiresAt.getTime() - Date.now(), 1);

    await this.storage.set(sessionKey(input.appId, input.id), session, ttlMs);

    return session;
  }

  async findById(
    appId: string,
    sessionId: string
  ): Promise<StoredSession | null> {
    return this.storage.get<StoredSession>(sessionKey(appId, sessionId));
  }

  async update(
    appId: string,
    sessionId: string,
    input: UpdateSessionInput
  ): Promise<StoredSession | null> {
    const existing = await this.findById(appId, sessionId);

    if (!existing) {
      return null;
    }

    const updated: StoredSession = {
      ...existing,

      ...(input.status !== undefined && {
        status: input.status,
      }),

      ...(input.deepLink !== undefined && {
        deepLink: input.deepLink,
      }),

      ...(input.deviceId !== undefined && {
        deviceId: input.deviceId,
      }),

      ...(input.metadata !== undefined && {
        metadata: input.metadata,
      }),
    };

    const remainingTtl = Math.max(
      new Date(updated.expiresAt).getTime() - Date.now(),
      1
    );

    await this.storage.set(sessionKey(appId, sessionId), updated, remainingTtl);

    return updated;
  }

  async activate(
    appId: string,
    sessionId: string,
    input: {
      deviceId: string;
    }
  ): Promise<StoredSession | null> {
    return this.update(appId, sessionId, {
      status: "ACTIVE",
      deviceId: input.deviceId,
    });
  }

  async delete(appId: string, sessionId: string): Promise<void> {
    await this.storage.delete(sessionKey(appId, sessionId));
  }

  async list(appId: string): Promise<StoredSession[]> {
    return this.storage.list<StoredSession>(sessionPrefix(appId));
  }
}
