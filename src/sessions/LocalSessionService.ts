// file: src/sessions/LocalSessionService.ts
import { randomBytes, createHash } from "node:crypto";

import type { StorageAdapter } from "../storage/StorageAdapter.js";

export interface LocalSession {
  id: string;
  appId: string;
  userId: string;
  deviceId: string;
  createdAt: string;
  expiresAt: string;
}

interface StoredSession extends LocalSession {
  tokenHash: string;
}

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionKey(appId: string, sessionId: string): string {
  return `session:${appId}:${sessionId}`;
}

/**
 * Local, backend-issued sessions — separate from Approva's hosted
 * SessionService (which manages blockchain-authorization sessions).
 * This is "is this browser the device that just passed WebAuthn."
 */
export class LocalSessionService {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly ttlMs: number = DEFAULT_SESSION_TTL_MS
  ) {}

  /** Call after WebAuthnService.finishAuthentication() succeeds. */
  async create(input: {
    appId: string;
    userId: string;
    deviceId: string;
  }): Promise<{ session: LocalSession; token: string }> {
    const token = randomBytes(32).toString("base64url");
    const id = randomBytes(16).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    const stored: StoredSession = {
      id,
      appId: input.appId,
      userId: input.userId,
      deviceId: input.deviceId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      tokenHash: hashToken(token),
    };

    await this.storage.set(sessionKey(input.appId, id), stored, this.ttlMs);

    const { tokenHash: _drop, ...session } = stored;

    return { session, token: `${id}.${token}` };
  }

  /** Validate a token handed back by the browser (e.g. an Authorization header). */
  async validate(appId: string, token: string): Promise<LocalSession | null> {
    const [id, secret] = token.split(".");
    if (!id || !secret) return null;

    const stored = await this.storage.get<StoredSession>(sessionKey(appId, id));

    if (!stored) return null;
    if (new Date(stored.expiresAt).getTime() < Date.now()) return null;
    if (stored.tokenHash !== hashToken(secret)) return null;

    const { tokenHash: _drop, ...session } = stored;
    return session;
  }

  async revoke(appId: string, sessionId: string): Promise<void> {
    await this.storage.delete(sessionKey(appId, sessionId));
  }
}
