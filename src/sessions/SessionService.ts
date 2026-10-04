import { randomUUID } from "node:crypto";

import type { WebAuthnService } from "../webauthn/WebAuthnService.js";
// import type { DeviceService } from "../devices/DeviceService.js";

import { ApprovaErrorCode } from "../errors/ApprovaErrorCode.js";

import { ApprovaServerError } from "../errors/ApprovaServerError.js";

import { ApprovaErrors } from "../errors/ApprovaErrors.js";

import { SessionRepository } from "./SessionRepository.js";

import type {
  ApprovaSession,
  CreateSessionInput,
  StoredSession,
  CompleteSessionInput,
  WebAuthnCeremony,
  SessionResponse,
} from "./types.js";
import type { TrustedDevice } from "../devices/types.js";
import type { DeviceService } from "../devices/DeviceService.js";

const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000;

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly webauthn: WebAuthnService,
    private readonly devices: DeviceService
  ) {}

  /**
   * Creates a pending session.
   *
   * The user has NOT authenticated yet.
   *
   * Flow:
   *
   * create()
   *   ↓
   * WebAuthn challenge
   *   ↓
   * pending session
   *   ↓
   * deep link
   *   ↓
   * frontend SDK
   */

  async create(
    appId: string,
    input: CreateSessionInput
  ): Promise<ApprovaSession> {
    this.validateAppId(appId);
    this.validateCreateInput(input);

    const sessionId = randomUUID();

    /**
     * Application user ID.
     *
     * This can be undefined for a first-time/anonymous
     * connection.
     */
    const applicationUserId = input.userId;

    /**
     * WebAuthn requires a stable user handle during
     * credential registration.
     *
     * When the application does not provide a userId,
     * generate an internal WebAuthn identity.
     */
    const webauthnUserId = input.userId ?? this.createAnonymousUserId();

    const expiresAt = this.resolveExpiration(input.expiresAt);

    /**
     * Determine whether this is:
     *
     * 1. First-time connection
     *    -> registration
     *
     * 2. Existing user with trusted device
     *    -> authentication
     *
     * When there is no application userId, there cannot
     * be an existing application-owned device lookup,
     * so this starts as registration.
     */
    let devices: TrustedDevice[] = [];

    if (applicationUserId) {
      try {
        devices = await this.devices.listForUser(appId, applicationUserId);
      } catch (error) {
        throw new ApprovaServerError({
          code: ApprovaErrorCode.DEVICE_LOOKUP_FAILED,
          message: "Failed to retrieve the user's trusted devices.",
          status: 500,
          cause: error,
          details: {
            appId,
            userId: applicationUserId,
          },
        });
      }
    }

    const activeDevices = devices.filter(
      (device) => device.status === "active"
    );

    const ceremony: WebAuthnCeremony =
      activeDevices.length > 0 ? "authentication" : "registration";
    console.log("ceremony type", ceremony);

    /**
     * Generate the appropriate WebAuthn challenge.
     */
    let challenge: string;

    try {
      if (ceremony === "registration") {
        const options = await this.webauthn.beginRegistration({
          appId,

          /**
           * If the application supplied a userId,
           * use it. Otherwise use the internally
           * generated WebAuthn identity.
           */
          userId: webauthnUserId ?? applicationUserId,

          userName: applicationUserId ?? `approva-user-${sessionId}`,

          deviceName:
            typeof input.metadata?.deviceName === "string"
              ? input.metadata.deviceName
              : "Approva Device",
        });

        challenge = options.challenge;
      } else {
        /**
         * Authentication can only happen when we found
         * an application user with an active device.
         */
        if (!applicationUserId) {
          throw new ApprovaServerError({
            code: ApprovaErrorCode.WEBAUTHN_INVALID_REQUEST,
            message:
              "A user ID is required when authenticating an existing device.",
            status: 400,
            details: {
              appId,
              ceremony,
            },
          });
        }

        const options = await this.webauthn.beginAuthentication({
          appId: input.appId,
          sessionId,
          userId: applicationUserId,
          deviceId: "",
        });

        challenge = options.challenge;
      }
    } catch (error) {
      if (error instanceof ApprovaServerError) {
        throw error;
      }

      throw new ApprovaServerError({
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        message:
          ceremony === "registration"
            ? "Failed to create the WebAuthn registration challenge."
            : "Failed to create the WebAuthn authentication challenge.",
        status: 500,
        cause: error,
        details: {
          appId,
          userId: applicationUserId,
          ceremony,
        },
      });
    }

    /**
     * Create the deep link used by the frontend/mobile SDK
     * to continue the connection flow.
     */
    const deepLink = this.createDeepLink({
      sessionId,
    });

    /**
     * Store the pending session.
     *
     * IMPORTANT:
     * Keep userId undefined when the application did not
     * provide one. The internally generated WebAuthn ID
     * should not leak into the application's user identity.
     */
    let session: StoredSession;

    try {
      session = await this.sessions.create({
        id: sessionId,
        appId,

        // Application identity, not WebAuthn identity.
        userId: applicationUserId,

        origin: input.origin,
        scopes: input.scopes,

        challenge,

        status: "PENDING",

        deepLink,

        createdAt: new Date(),

        expiresAt,

        metadata: {
          ...input.metadata,

          /**
           * Store enough information to finish the
           * registration ceremony later.
           */
          webauthnUserId,

          ceremony,
        },
      });
    } catch (error) {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.SESSION_CREATION_FAILED,
        message: "Failed to create the Approva session.",
        status: 500,
        cause: error,
        details: {
          appId,
          sessionId,
        },
      });
    }

    return this.toPublicSession(session);
  }

  createAnonymousUserId(): string {
    return `anon_${randomUUID()}`;
  }

  /**
   * Gets a session.
   */
  async get(appId: string, sessionId: string): Promise<ApprovaSession> {
    this.validateIdentifiers(appId, sessionId);

    const session = await this.getStoredSession(appId, sessionId);

    const sessionWithStatus = await this.ensureSessionState(session);

    return this.toPublicSession(sessionWithStatus);
  }

  /**
   * Returns the current session establishment
   * result.
   */
  async getResponse(
    appId: string,
    sessionId: string
  ): Promise<SessionResponse | any> {
    this.validateIdentifiers(appId, sessionId);
    const session = await this.getStoredSession(appId, sessionId);
    const updated = await this.ensureSessionState(session);
    return {
      sessionId: updated.id,
      status: updated.status,
      expiresAt: updated.expiresAt,
    };
  }

  /**
   * Completes a pending session after the
   * frontend SDK has performed WebAuthn.
   */
  async complete(
    appId: string,
    sessionId: string,
    input: CompleteSessionInput
  ): Promise<ApprovaSession> {
    this.validateIdentifiers(appId, sessionId);

    if (!input?.credential) {
      throw ApprovaErrors.invalidRequest("A WebAuthn credential is required.", {
        field: "credential",
      });
    }

    let session = await this.getStoredSession(appId, sessionId);

    session = await this.ensureSessionState(session);

    if (session.status === "ACTIVE") {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.SESSION_ALREADY_ACTIVE,
        message: "The session has already been authenticated.",
        status: 409,
        details: {
          sessionId,
        },
      });
    }

    if (session.status === "REVOKED") {
      throw ApprovaErrors.sessionRevoked(sessionId);
    }

    if (session.status === "EXPIRED") {
      throw ApprovaErrors.sessionExpired(sessionId);
    }

    if (session.status !== "PENDING") {
      throw ApprovaErrors.sessionInvalidState(sessionId, session.status);
    }

    let device;

    try {
      const verification = await this.webauthn.finishAuthentication({
        appId,
        sessionId: input.sessionId,
        response: input.credential,
      });

      device = verification;
    } catch (error) {
      if (error instanceof ApprovaServerError) {
        try {
          await this.sessions.update(appId, sessionId, {
            status: "FAILED",
          });
        } catch {
          // Preserve the original error.
        }

        throw error;
      }

      try {
        await this.sessions.update(appId, sessionId, {
          status: "FAILED",
        });
      } catch {
        // Preserve original error.
      }

      throw new ApprovaServerError({
        code: ApprovaErrorCode.WEBAUTHN_VERIFICATION_FAILED,
        message: "WebAuthn authentication failed.",
        status: 401,
        details: {
          sessionId,
        },
        cause: error,
      });
    }

    if (!device?.id) {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.DEVICE_REGISTRATION_FAILED,
        message: "The authenticated device could not be identified.",
        status: 500,
        details: {
          sessionId,
        },
      });
    }

    let activeSession: StoredSession | null;

    try {
      activeSession = await this.sessions.activate(appId, sessionId, {
        deviceId: device.id,
      });
    } catch (error) {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.SESSION_COMPLETION_FAILED,
        message: "Failed to activate the Approva session.",
        status: 500,
        details: {
          sessionId,
          deviceId: device.id,
        },
        cause: error,
      });
    }

    if (!activeSession) {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.SESSION_COMPLETION_FAILED,
        message: "The session could not be activated.",
        status: 500,
        details: {
          sessionId,
        },
      });
    }

    return this.toPublicSession(activeSession);
  }

  /**
   * Revokes an existing session.
   */
  async revoke(appId: string, sessionId: string): Promise<void> {
    this.validateIdentifiers(appId, sessionId);

    const session = await this.getStoredSession(appId, sessionId);

    if (session.status === "REVOKED") {
      throw ApprovaErrors.sessionRevoked(sessionId);
    }

    if (session.status === "EXPIRED") {
      throw ApprovaErrors.sessionExpired(sessionId);
    }

    try {
      await this.sessions.update(appId, sessionId, {
        status: "REVOKED",
      });
    } catch (error) {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.SESSION_COMPLETION_FAILED,
        message: "Failed to revoke the Approva session.",
        status: 500,
        details: {
          sessionId,
        },
        cause: error,
      });
    }
  }

  /**
   * Lists sessions belonging to an application.
   */
  async list(appId: string): Promise<ApprovaSession[]> {
    this.validateAppId(appId);

    try {
      const sessions = await this.sessions.list(appId);

      const result: ApprovaSession[] = [];

      for (const session of sessions) {
        const updated = await this.ensureSessionState(session);

        result.push(this.toPublicSession(updated));
      }

      return result;
    } catch (error) {
      if (error instanceof ApprovaServerError) {
        throw error;
      }

      throw new ApprovaServerError({
        code: ApprovaErrorCode.INTERNAL_ERROR,
        message: "Failed to retrieve application sessions.",
        status: 500,
        cause: error,
      });
    }
  }

  private async getStoredSession(
    appId: string,
    sessionId: string
  ): Promise<StoredSession> {
    const session = await this.sessions.findById(appId, sessionId);

    if (!session) {
      throw ApprovaErrors.sessionNotFound(sessionId);
    }

    return session;
  }

  private async ensureSessionState(
    session: StoredSession
  ): Promise<StoredSession> {
    if (
      session.status === "ACTIVE" ||
      session.status === "REVOKED" ||
      session.status === "FAILED"
    ) {
      return session;
    }

    const expiresAt = new Date(session.expiresAt).getTime();

    if (Number.isNaN(expiresAt)) {
      throw new ApprovaServerError({
        code: ApprovaErrorCode.INTERNAL_ERROR,
        message: "The session contains an invalid expiration date.",
        status: 500,
        details: {
          sessionId: session.id,
        },
      });
    }

    if (expiresAt <= Date.now()) {
      try {
        const updated = await this.sessions.update(session.appId, session.id, {
          status: "EXPIRED",
        });

        if (updated) {
          return updated;
        }
      } catch (error) {
        throw new ApprovaServerError({
          code: ApprovaErrorCode.INTERNAL_ERROR,
          message: "Failed to expire the session.",
          status: 500,
          details: {
            sessionId: session.id,
          },
          cause: error,
        });
      }

      return {
        ...session,
        status: "EXPIRED",
      };
    }

    return session;
  }

  private validateAppId(appId: string): void {
    if (!appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId",
      });
    }
  }

  private validateIdentifiers(appId: string, sessionId: string): void {
    this.validateAppId(appId);

    if (!sessionId?.trim()) {
      throw ApprovaErrors.invalidRequest("A session ID is required.", {
        field: "sessionId",
      });
    }
  }

  private validateCreateInput(input: CreateSessionInput): void {
    if (!input) {
      throw ApprovaErrors.invalidRequest("Session input is required.");
    }

    if (!input.origin?.trim()) {
      throw ApprovaErrors.invalidRequest("An origin is required.", {
        field: "origin",
      });
    }

    if (!Array.isArray(input.scopes)) {
      throw ApprovaErrors.invalidRequest("Scopes must be an array.", {
        field: "scopes",
      });
    }

    if (
      input.scopes.some((scope) => typeof scope !== "string" || !scope.trim())
    ) {
      throw ApprovaErrors.invalidRequest(
        "Every scope must be a non-empty string.",
        {
          field: "scopes",
        }
      );
    }

    if (input.expiresAt !== undefined) {
      const expiration = new Date(input.expiresAt);

      if (Number.isNaN(expiration.getTime())) {
        throw ApprovaErrors.invalidRequest(
          "The session expiration date is invalid.",
          {
            field: "expiresAt",
          }
        );
      }

      if (expiration.getTime() <= Date.now()) {
        throw ApprovaErrors.invalidRequest(
          "The session expiration date must be in the future.",
          {
            field: "expiresAt",
          }
        );
      }
    }
  }

  private resolveExpiration(expiresAt?: string): Date {
    if (!expiresAt) {
      return new Date(Date.now() + DEFAULT_SESSION_TTL_MS);
    }

    const date = new Date(expiresAt);

    if (Number.isNaN(date.getTime())) {
      throw ApprovaErrors.invalidRequest(
        "The session expiration date is invalid.",
        {
          field: "expiresAt",
        }
      );
    }

    return date;
  }

  private toPublicSession(session: StoredSession): ApprovaSession {
    return {
      id: session.id,
      appId: session.appId,
      userId: session.userId,
      origin: session.origin,
      scopes: session.scopes,
      status: session.status,
      deepLink: session.deepLink,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      deviceId: session.deviceId ?? "",
      metadata: session.metadata,
    };
  }

  private createDeepLink(input: { sessionId: string }): string {
    const url = new URL("approva://session");

    url.searchParams.set("session", input.sessionId);

    return url.toString();
  }
}
