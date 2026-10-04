import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export type SessionStatus =
  | "PENDING"
  | "AUTHENTICATING"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "CANCELLED"
  | "FAILED";

export interface CreateSessionInput {
  appId: string;
  userId?: string;

  /**
   * Browser/application origin.
   */
  origin: string;

  /**
   * Requested permissions for this session.
   */
  scopes: string[];

  /**
   * Optional session expiration.
   */
  expiresAt?: string;

  metadata?: Record<string, unknown>;
}

export interface SessionRequest {
  id: string;
  appId: string;
  userId?: string;

  origin: string;
  scopes: string[];

  status: SessionStatus;

  /**
   * WebAuthn challenge used to establish the session.
   */
  challenge: string;

  /**
   * Deep link used to open the Approva frontend/mobile SDK.
   */
  deepLink: string;

  createdAt: string;
  expiresAt: string;

  metadata?: Record<string, unknown>;
}

export interface ApprovaSession {
  id: string;
  appId: string;

  userId?: string;
  deviceId: string;

  origin: string;
  scopes: string[];

  status: SessionStatus;

  createdAt: string;
  expiresAt: string;

  metadata?: Record<string, unknown>;
}

export interface StoredSession {
  id: string;

  appId: string;

  userId?: string;

  origin: string;

  scopes: string[];

  status: SessionStatus;

  challenge?: string; //[x] will check if it's neccessary to create a challenge earlier

  deepLink: string;

  createdAt: string;

  expiresAt: string;

  deviceId?: string;

  metadata?: Record<string, unknown>;
}

export interface ApprovaSession {
  id: string;

  appId: string;

  userId?: string;

  origin: string;

  scopes: string[];

  status: SessionStatus;

  deepLink: string;

  createdAt: string;

  expiresAt: string;

  deviceId: string;

  metadata?: Record<string, unknown>;
}

export interface SessionResponse {
  sessionId: string;

  status: SessionStatus;

  session?: ApprovaSession;
}

export interface CompleteSessionInput {
  credential: AuthenticationResponseJSON;
  sessionId: string;
}

export type WebAuthnCeremony = "registration" | "authentication";
