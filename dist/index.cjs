'use strict';

var zod = require('zod');
var axios = require('axios');
var crypto$1 = require('crypto');
var server = require('@simplewebauthn/server');
var fs = require('fs');
var path = require('path');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var axios__default = /*#__PURE__*/_interopDefault(axios);
var path__default = /*#__PURE__*/_interopDefault(path);

// src/config/server.config.ts
var ServerEnvironmentSchema = zod.z.enum([
  "development",
  "staging",
  "production"
]);
var ApprovaServerConfigSchema = zod.z.object({
  /**
   * Public application identifier.
   */
  appId: zod.z.string().min(1, "appId is required"),
  /**
   * Approva API URL.
   */
  apiUrl: zod.z.string().url("apiUrl must be a valid URL"),
  /**
   * Network used by the application.
   *
   * Approva currently targets Base.
   */
  network: zod.z.literal("base").default("base"),
  /**
   * Optional Base RPC URL.
   */
  rpcUrl: zod.z.string().url().optional(),
  /**
   * Server request timeout.
   */
  requestTimeoutMs: zod.z.number().int().positive().default(15e3),
  /**
   * Number of transient request retries.
   */
  maxRetries: zod.z.number().int().min(0).max(5).default(2),
  environment: ServerEnvironmentSchema.default("development")
});
function createServerConfig(config) {
  const result = ApprovaServerConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid Approva Server SDK configuration:
${errors}`);
  }
  return result.data;
}

// src/errors/ApprovaErrorCode.ts
var ApprovaErrorCode = /* @__PURE__ */ ((ApprovaErrorCode2) => {
  ApprovaErrorCode2["UNKNOWN_ERROR"] = "APPROVA_UNKNOWN_ERROR";
  ApprovaErrorCode2["INVALID_REQUEST"] = "APPROVA_INVALID_REQUEST";
  ApprovaErrorCode2["UNAUTHORIZED"] = "APPROVA_UNAUTHORIZED";
  ApprovaErrorCode2["FORBIDDEN"] = "APPROVA_FORBIDDEN";
  ApprovaErrorCode2["NOT_FOUND"] = "APPROVA_NOT_FOUND";
  ApprovaErrorCode2["CONFLICT"] = "APPROVA_CONFLICT";
  ApprovaErrorCode2["RATE_LIMITED"] = "APPROVA_RATE_LIMITED";
  ApprovaErrorCode2["INTERNAL_ERROR"] = "APPROVA_INTERNAL_ERROR";
  ApprovaErrorCode2["SESSION_NOT_FOUND"] = "APPROVA_SESSION_NOT_FOUND";
  ApprovaErrorCode2["SESSION_EXPIRED"] = "APPROVA_SESSION_EXPIRED";
  ApprovaErrorCode2["SESSION_REVOKED"] = "APPROVA_SESSION_REVOKED";
  ApprovaErrorCode2["SESSION_CANCELLED"] = "APPROVA_SESSION_CANCELLED";
  ApprovaErrorCode2["SESSION_ALREADY_ACTIVE"] = "APPROVA_SESSION_ALREADY_ACTIVE";
  ApprovaErrorCode2["SESSION_INVALID_STATE"] = "APPROVA_SESSION_INVALID_STATE";
  ApprovaErrorCode2["SESSION_CREATION_FAILED"] = "APPROVA_SESSION_CREATION_FAILED";
  ApprovaErrorCode2["SESSION_COMPLETION_FAILED"] = "APPROVA_SESSION_COMPLETION_FAILED";
  ApprovaErrorCode2["DEVICE_NOT_FOUND"] = "APPROVA_DEVICE_NOT_FOUND";
  ApprovaErrorCode2["DEVICE_REVOKED"] = "APPROVA_DEVICE_REVOKED";
  ApprovaErrorCode2["DEVICE_REGISTRATION_FAILED"] = "APPROVA_DEVICE_REGISTRATION_FAILED";
  ApprovaErrorCode2["WEBAUTHN_CHALLENGE_FAILED"] = "APPROVA_WEBAUTHN_CHALLENGE_FAILED";
  ApprovaErrorCode2["WEBAUTHN_VERIFICATION_FAILED"] = "APPROVA_WEBAUTHN_VERIFICATION_FAILED";
  ApprovaErrorCode2["WEBAUTHN_CREDENTIAL_INVALID"] = "APPROVA_WEBAUTHN_CREDENTIAL_INVALID";
  ApprovaErrorCode2["WEBAUTHN_CHALLENGE_MISSING"] = "WEBAUTHN_CHALLENGE_MISSING";
  ApprovaErrorCode2["WEBAUTHN_NOT_VERIFIED"] = "WEBAUTHN_NOT_VERIFIED";
  ApprovaErrorCode2["WEBAUTHN_NO_DEVICES"] = "WEBAUTHN_NO_DEVICES";
  ApprovaErrorCode2["WEBAUTHN_UNKNOWN_DEVICE"] = "WEBAUTHN_UNKNOWN_DEVICE";
  ApprovaErrorCode2["AUTHORIZATION_NOT_FOUND"] = "APPROVA_AUTHORIZATION_NOT_FOUND";
  ApprovaErrorCode2["AUTHORIZATION_EXPIRED"] = "APPROVA_AUTHORIZATION_EXPIRED";
  ApprovaErrorCode2["AUTHORIZATION_REJECTED"] = "APPROVA_AUTHORIZATION_REJECTED";
  ApprovaErrorCode2["AUTHORIZATION_INVALID_STATE"] = "APPROVA_AUTHORIZATION_INVALID_STATE";
  ApprovaErrorCode2["API_UNAVAILABLE"] = "APPROVA_API_UNAVAILABLE";
  ApprovaErrorCode2["API_REQUEST_FAILED"] = "APPROVA_API_REQUEST_FAILED";
  ApprovaErrorCode2["API_RESPONSE_INVALID"] = "APPROVA_API_RESPONSE_INVALID";
  ApprovaErrorCode2["NETWORK_ERROR"] = "NETWORK_ERROR";
  ApprovaErrorCode2["HTTP_ERROR"] = "HTTP_ERROR";
  ApprovaErrorCode2["REQUEST_TIMEOUT"] = "REQUEST_TIMEOUT";
  ApprovaErrorCode2["DEVICE_LOOKUP_FAILED"] = "DEVICE_LOOKUP_FAILED";
  ApprovaErrorCode2["WEBAUTHN_INVALID_REQUEST"] = "WEBAUTHN_INVALID_REQUEST";
  ApprovaErrorCode2["WEBSOCKET_TIMEOUT"] = "WEBSOCKET_TIMEOUT";
  ApprovaErrorCode2["WEBSOCKET_CONNECTION_FAILED"] = "WEBSOCKET_CONNECTION_FAILED";
  ApprovaErrorCode2["WEBSOCKET_NOT_CONNECTED"] = "WEBSOCKET_NOT_CONNECTED";
  ApprovaErrorCode2["SESSION_INVALID_STATUS"] = "SESSION_INVALID_STATUS";
  return ApprovaErrorCode2;
})(ApprovaErrorCode || {});

// src/errors/ApprovaServerError.ts
var ApprovaServerError = class _ApprovaServerError extends Error {
  code;
  status;
  details;
  constructor(params) {
    super(params.message, {
      cause: params.cause
    });
    this.name = "ApprovaServerError";
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    Object.setPrototypeOf(this, _ApprovaServerError.prototype);
  }
  /**
   * Returns a safe, serializable representation
   * of the error.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }
  /**
   * Creates an ApprovaServerError from an unknown
   * thrown value.
   */
  static from(error, fallback = {}) {
    if (error instanceof _ApprovaServerError) {
      return error;
    }
    if (error instanceof Error) {
      return new _ApprovaServerError({
        message: fallback.message ?? error.message ?? "An unknown Approva server error occurred.",
        code: fallback.code ?? "APPROVA_UNKNOWN_ERROR" /* UNKNOWN_ERROR */,
        status: fallback.status,
        cause: error
      });
    }
    return new _ApprovaServerError({
      message: fallback.message ?? "An unknown Approva server error occurred.",
      code: fallback.code ?? "APPROVA_UNKNOWN_ERROR" /* UNKNOWN_ERROR */,
      status: fallback.status,
      details: error
    });
  }
};

// src/errors/isApprovaErrorCode.ts
function isApprovaErrorCode(value) {
  if (typeof value !== "string") {
    return false;
  }
  return Object.values(ApprovaErrorCode).includes(value);
}

// src/http/HttpClient.ts
var HttpClient = class {
  constructor(options) {
    this.options = options;
    this.client = axios__default.default.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.serverKey}`
      }
    });
  }
  options;
  client;
  get baseUrl() {
    return this.options.baseUrl;
  }
  async get(path2) {
    return this.request("GET", path2);
  }
  async post(path2, body) {
    return this.request("POST", path2, body);
  }
  async delete(path2) {
    return this.request("DELETE", path2);
  }
  resolveUrl(path2) {
    return `${this.options.baseUrl.replace(/\/+$/, "")}/${path2.replace(
      /^\/+/,
      ""
    )}`;
  }
  async request(method, path2, body) {
    try {
      const response = await this.client.request({
        method,
        url: path2,
        data: body
      });
      return response.data;
    } catch (error) {
      throw this.toApprovaServerError(error, path2);
    }
  }
  toApprovaServerError(error, path2) {
    if (error instanceof ApprovaServerError) {
      return error;
    }
    const url = this.resolveUrl(path2);
    if (axios__default.default.isAxiosError(error)) {
      return this.handleAxiosError(error, url);
    }
    return new ApprovaServerError({
      message: `${error instanceof Error ? error.message : "Approva request failed."} (${url})`,
      code: "NETWORK_ERROR" /* NETWORK_ERROR */,
      details: error,
      cause: error
    });
  }
  handleAxiosError(error, url) {
    if (!error.response) {
      const isTimeout = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
      if (isTimeout) {
        return new ApprovaServerError({
          message: `Approva request timed out. (${url})`,
          code: "REQUEST_TIMEOUT" /* REQUEST_TIMEOUT */,
          status: 408,
          details: error.toJSON?.() ?? error,
          cause: error
        });
      }
      return new ApprovaServerError({
        message: `${error.message || "Approva network request failed."} (${url})`,
        code: "NETWORK_ERROR" /* NETWORK_ERROR */,
        details: error.toJSON?.() ?? error,
        cause: error
      });
    }
    const status = error.response.status;
    const data = error.response.data;
    const message = this.extractMessage(data, status, url);
    const code = this.extractErrorCode(data);
    return new ApprovaServerError({
      message,
      code,
      status,
      details: this.extractDetails(data),
      cause: error
    });
  }
  extractMessage(data, status, url) {
    if (data && typeof data === "object" && "message" in data) {
      const message = data.message;
      if (typeof message === "string" && message.trim()) {
        return `${message} (${url})`;
      }
    }
    return `Approva request failed with status ${status}. (${url})`;
  }
  extractErrorCode(data) {
    if (data && typeof data === "object" && "code" in data) {
      const value = data.code;
      if (isApprovaErrorCode(value)) {
        return value;
      }
    }
    return "HTTP_ERROR" /* HTTP_ERROR */;
  }
  extractDetails(data) {
    if (data && typeof data === "object" && "details" in data) {
      return data.details;
    }
    return data;
  }
};

// src/errors/ApprovaErrors.ts
var ApprovaErrors = {
  invalidRequest(message = "The request is invalid.", details) {
    return new ApprovaServerError({
      code: "APPROVA_INVALID_REQUEST" /* INVALID_REQUEST */,
      message,
      status: 400,
      details
    });
  },
  unauthorized(message = "Authentication is required.", details) {
    return new ApprovaServerError({
      code: "APPROVA_UNAUTHORIZED" /* UNAUTHORIZED */,
      message,
      status: 401,
      details
    });
  },
  forbidden(message = "You are not authorized to perform this operation.", details) {
    return new ApprovaServerError({
      code: "APPROVA_FORBIDDEN" /* FORBIDDEN */,
      message,
      status: 403,
      details
    });
  },
  notFound(message = "The requested resource was not found.", details) {
    return new ApprovaServerError({
      code: "APPROVA_NOT_FOUND" /* NOT_FOUND */,
      message,
      status: 404,
      details
    });
  },
  conflict(message = "The requested operation conflicts with the current state.", details) {
    return new ApprovaServerError({
      code: "APPROVA_CONFLICT" /* CONFLICT */,
      message,
      status: 409,
      details
    });
  },
  sessionNotFound(sessionId) {
    return new ApprovaServerError({
      code: "APPROVA_SESSION_NOT_FOUND" /* SESSION_NOT_FOUND */,
      message: `Session '${sessionId}' was not found.`,
      status: 404,
      details: {
        sessionId
      }
    });
  },
  sessionExpired(sessionId) {
    return new ApprovaServerError({
      code: "APPROVA_SESSION_EXPIRED" /* SESSION_EXPIRED */,
      message: `Session '${sessionId}' has expired.`,
      status: 410,
      details: {
        sessionId
      }
    });
  },
  sessionRevoked(sessionId) {
    return new ApprovaServerError({
      code: "APPROVA_SESSION_REVOKED" /* SESSION_REVOKED */,
      message: `Session '${sessionId}' has been revoked.`,
      status: 410,
      details: {
        sessionId
      }
    });
  },
  sessionInvalidState(sessionId, state) {
    return new ApprovaServerError({
      code: "APPROVA_SESSION_INVALID_STATE" /* SESSION_INVALID_STATE */,
      message: `Session '${sessionId}' cannot be used in its current state.`,
      status: 409,
      details: {
        sessionId,
        state
      }
    });
  },
  sessionCreationFailed(cause) {
    return new ApprovaServerError({
      code: "APPROVA_SESSION_CREATION_FAILED" /* SESSION_CREATION_FAILED */,
      message: "Failed to create the Approva session.",
      status: 500,
      cause
    });
  },
  sessionCompletionFailed(cause) {
    return new ApprovaServerError({
      code: "APPROVA_SESSION_COMPLETION_FAILED" /* SESSION_COMPLETION_FAILED */,
      message: "Failed to complete the Approva session.",
      status: 500,
      cause
    });
  },
  apiUnavailable(cause) {
    return new ApprovaServerError({
      code: "APPROVA_API_UNAVAILABLE" /* API_UNAVAILABLE */,
      message: "The Approva API is unavailable.",
      status: 503,
      cause
    });
  },
  apiRequestFailed(status, details, cause) {
    return new ApprovaServerError({
      code: "APPROVA_API_REQUEST_FAILED" /* API_REQUEST_FAILED */,
      message: "The Approva API request failed.",
      status,
      details,
      cause
    });
  },
  apiResponseInvalid(details) {
    return new ApprovaServerError({
      code: "APPROVA_API_RESPONSE_INVALID" /* API_RESPONSE_INVALID */,
      message: "The Approva API returned an invalid response.",
      status: 502,
      details
    });
  },
  webauthnVerificationFailed(details, cause) {
    return new ApprovaServerError({
      code: "APPROVA_WEBAUTHN_VERIFICATION_FAILED" /* WEBAUTHN_VERIFICATION_FAILED */,
      message: "WebAuthn verification failed.",
      status: 401,
      details,
      cause
    });
  }
};

// src/sessions/session.keys.ts
function sessionKey(appId, sessionId) {
  return `approva:session:${appId}:${sessionId}`;
}
function sessionPrefix(appId) {
  return `approva:session:${appId}:`;
}

// src/sessions/SessionRepository.ts
var SessionRepository = class {
  constructor(storage) {
    this.storage = storage;
  }
  storage;
  async create(input) {
    const session = {
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
      metadata: input.metadata
    };
    const ttlMs = Math.max(input.expiresAt.getTime() - Date.now(), 1);
    await this.storage.set(sessionKey(input.appId, input.id), session, ttlMs);
    return session;
  }
  async findById(appId, sessionId) {
    return this.storage.get(sessionKey(appId, sessionId));
  }
  async update(appId, sessionId, input) {
    const existing = await this.findById(appId, sessionId);
    if (!existing) {
      return null;
    }
    const updated = {
      ...existing,
      ...input.status !== void 0 && {
        status: input.status
      },
      ...input.deepLink !== void 0 && {
        deepLink: input.deepLink
      },
      ...input.deviceId !== void 0 && {
        deviceId: input.deviceId
      },
      ...input.metadata !== void 0 && {
        metadata: input.metadata
      }
    };
    const remainingTtl = Math.max(
      new Date(updated.expiresAt).getTime() - Date.now(),
      1
    );
    await this.storage.set(sessionKey(appId, sessionId), updated, remainingTtl);
    return updated;
  }
  async activate(appId, sessionId, input) {
    return this.update(appId, sessionId, {
      status: "ACTIVE",
      deviceId: input.deviceId
    });
  }
  async delete(appId, sessionId) {
    await this.storage.delete(sessionKey(appId, sessionId));
  }
  async list(appId) {
    return this.storage.list(sessionPrefix(appId));
  }
};

// src/sessions/SessionService.ts
var DEFAULT_SESSION_TTL_MS = 5 * 60 * 1e3;
var SessionService = class {
  constructor(sessions, webauthn, devices) {
    this.sessions = sessions;
    this.webauthn = webauthn;
    this.devices = devices;
  }
  sessions;
  webauthn;
  devices;
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
  async create(appId, input) {
    this.validateAppId(appId);
    this.validateCreateInput(input);
    const sessionId = crypto$1.randomUUID();
    const applicationUserId = input.userId;
    const webauthnUserId = input.userId ?? this.createAnonymousUserId();
    const expiresAt = this.resolveExpiration(input.expiresAt);
    let devices = [];
    if (applicationUserId) {
      try {
        devices = await this.devices.listForUser(appId, applicationUserId);
      } catch (error) {
        throw new ApprovaServerError({
          code: "DEVICE_LOOKUP_FAILED" /* DEVICE_LOOKUP_FAILED */,
          message: "Failed to retrieve the user's trusted devices.",
          status: 500,
          cause: error,
          details: {
            appId,
            userId: applicationUserId
          }
        });
      }
    }
    const activeDevices = devices.filter(
      (device) => device.status === "active"
    );
    const ceremony = activeDevices.length > 0 ? "authentication" : "registration";
    console.log("ceremony type", ceremony);
    let challenge;
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
          deviceName: typeof input.metadata?.deviceName === "string" ? input.metadata.deviceName : "Approva Device"
        });
        challenge = options.challenge;
      } else {
        if (!applicationUserId) {
          throw new ApprovaServerError({
            code: "WEBAUTHN_INVALID_REQUEST" /* WEBAUTHN_INVALID_REQUEST */,
            message: "A user ID is required when authenticating an existing device.",
            status: 400,
            details: {
              appId,
              ceremony
            }
          });
        }
        const options = await this.webauthn.beginAuthentication({
          appId: input.appId,
          sessionId,
          userId: applicationUserId,
          deviceId: ""
        });
        challenge = options.challenge;
      }
    } catch (error) {
      if (error instanceof ApprovaServerError) {
        throw error;
      }
      throw new ApprovaServerError({
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        message: ceremony === "registration" ? "Failed to create the WebAuthn registration challenge." : "Failed to create the WebAuthn authentication challenge.",
        status: 500,
        cause: error,
        details: {
          appId,
          userId: applicationUserId,
          ceremony
        }
      });
    }
    const deepLink = this.createDeepLink({
      sessionId
    });
    let session;
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
        createdAt: /* @__PURE__ */ new Date(),
        expiresAt,
        metadata: {
          ...input.metadata,
          /**
           * Store enough information to finish the
           * registration ceremony later.
           */
          webauthnUserId,
          ceremony
        }
      });
    } catch (error) {
      throw new ApprovaServerError({
        code: "APPROVA_SESSION_CREATION_FAILED" /* SESSION_CREATION_FAILED */,
        message: "Failed to create the Approva session.",
        status: 500,
        cause: error,
        details: {
          appId,
          sessionId
        }
      });
    }
    return this.toPublicSession(session);
  }
  createAnonymousUserId() {
    return `anon_${crypto$1.randomUUID()}`;
  }
  /**
   * Gets a session.
   */
  async get(appId, sessionId) {
    this.validateIdentifiers(appId, sessionId);
    const session = await this.getStoredSession(appId, sessionId);
    const sessionWithStatus = await this.ensureSessionState(session);
    return this.toPublicSession(sessionWithStatus);
  }
  /**
   * Returns the current session establishment
   * result.
   */
  async getResponse(appId, sessionId) {
    this.validateIdentifiers(appId, sessionId);
    const session = await this.getStoredSession(appId, sessionId);
    const updated = await this.ensureSessionState(session);
    return {
      sessionId: updated.id,
      status: updated.status,
      expiresAt: updated.expiresAt
    };
  }
  /**
   * Completes a pending session after the
   * frontend SDK has performed WebAuthn.
   */
  async complete(appId, sessionId, input) {
    this.validateIdentifiers(appId, sessionId);
    if (!input?.credential) {
      throw ApprovaErrors.invalidRequest("A WebAuthn credential is required.", {
        field: "credential"
      });
    }
    let session = await this.getStoredSession(appId, sessionId);
    session = await this.ensureSessionState(session);
    if (session.status === "ACTIVE") {
      throw new ApprovaServerError({
        code: "APPROVA_SESSION_ALREADY_ACTIVE" /* SESSION_ALREADY_ACTIVE */,
        message: "The session has already been authenticated.",
        status: 409,
        details: {
          sessionId
        }
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
        response: input.credential
      });
      device = verification;
    } catch (error) {
      if (error instanceof ApprovaServerError) {
        try {
          await this.sessions.update(appId, sessionId, {
            status: "FAILED"
          });
        } catch {
        }
        throw error;
      }
      try {
        await this.sessions.update(appId, sessionId, {
          status: "FAILED"
        });
      } catch {
      }
      throw new ApprovaServerError({
        code: "APPROVA_WEBAUTHN_VERIFICATION_FAILED" /* WEBAUTHN_VERIFICATION_FAILED */,
        message: "WebAuthn authentication failed.",
        status: 401,
        details: {
          sessionId
        },
        cause: error
      });
    }
    if (!device?.id) {
      throw new ApprovaServerError({
        code: "APPROVA_DEVICE_REGISTRATION_FAILED" /* DEVICE_REGISTRATION_FAILED */,
        message: "The authenticated device could not be identified.",
        status: 500,
        details: {
          sessionId
        }
      });
    }
    let activeSession;
    try {
      activeSession = await this.sessions.activate(appId, sessionId, {
        deviceId: device.id
      });
    } catch (error) {
      throw new ApprovaServerError({
        code: "APPROVA_SESSION_COMPLETION_FAILED" /* SESSION_COMPLETION_FAILED */,
        message: "Failed to activate the Approva session.",
        status: 500,
        details: {
          sessionId,
          deviceId: device.id
        },
        cause: error
      });
    }
    if (!activeSession) {
      throw new ApprovaServerError({
        code: "APPROVA_SESSION_COMPLETION_FAILED" /* SESSION_COMPLETION_FAILED */,
        message: "The session could not be activated.",
        status: 500,
        details: {
          sessionId
        }
      });
    }
    return this.toPublicSession(activeSession);
  }
  /**
   * Revokes an existing session.
   */
  async revoke(appId, sessionId) {
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
        status: "REVOKED"
      });
    } catch (error) {
      throw new ApprovaServerError({
        code: "APPROVA_SESSION_COMPLETION_FAILED" /* SESSION_COMPLETION_FAILED */,
        message: "Failed to revoke the Approva session.",
        status: 500,
        details: {
          sessionId
        },
        cause: error
      });
    }
  }
  /**
   * Lists sessions belonging to an application.
   */
  async list(appId) {
    this.validateAppId(appId);
    try {
      const sessions = await this.sessions.list(appId);
      const result = [];
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
        code: "APPROVA_INTERNAL_ERROR" /* INTERNAL_ERROR */,
        message: "Failed to retrieve application sessions.",
        status: 500,
        cause: error
      });
    }
  }
  async getStoredSession(appId, sessionId) {
    const session = await this.sessions.findById(appId, sessionId);
    if (!session) {
      throw ApprovaErrors.sessionNotFound(sessionId);
    }
    return session;
  }
  async ensureSessionState(session) {
    if (session.status === "ACTIVE" || session.status === "REVOKED" || session.status === "FAILED") {
      return session;
    }
    const expiresAt = new Date(session.expiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      throw new ApprovaServerError({
        code: "APPROVA_INTERNAL_ERROR" /* INTERNAL_ERROR */,
        message: "The session contains an invalid expiration date.",
        status: 500,
        details: {
          sessionId: session.id
        }
      });
    }
    if (expiresAt <= Date.now()) {
      try {
        const updated = await this.sessions.update(session.appId, session.id, {
          status: "EXPIRED"
        });
        if (updated) {
          return updated;
        }
      } catch (error) {
        throw new ApprovaServerError({
          code: "APPROVA_INTERNAL_ERROR" /* INTERNAL_ERROR */,
          message: "Failed to expire the session.",
          status: 500,
          details: {
            sessionId: session.id
          },
          cause: error
        });
      }
      return {
        ...session,
        status: "EXPIRED"
      };
    }
    return session;
  }
  validateAppId(appId) {
    if (!appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId"
      });
    }
  }
  validateIdentifiers(appId, sessionId) {
    this.validateAppId(appId);
    if (!sessionId?.trim()) {
      throw ApprovaErrors.invalidRequest("A session ID is required.", {
        field: "sessionId"
      });
    }
  }
  validateCreateInput(input) {
    if (!input) {
      throw ApprovaErrors.invalidRequest("Session input is required.");
    }
    if (!input.origin?.trim()) {
      throw ApprovaErrors.invalidRequest("An origin is required.", {
        field: "origin"
      });
    }
    if (!Array.isArray(input.scopes)) {
      throw ApprovaErrors.invalidRequest("Scopes must be an array.", {
        field: "scopes"
      });
    }
    if (input.scopes.some((scope) => typeof scope !== "string" || !scope.trim())) {
      throw ApprovaErrors.invalidRequest(
        "Every scope must be a non-empty string.",
        {
          field: "scopes"
        }
      );
    }
    if (input.expiresAt !== void 0) {
      const expiration = new Date(input.expiresAt);
      if (Number.isNaN(expiration.getTime())) {
        throw ApprovaErrors.invalidRequest(
          "The session expiration date is invalid.",
          {
            field: "expiresAt"
          }
        );
      }
      if (expiration.getTime() <= Date.now()) {
        throw ApprovaErrors.invalidRequest(
          "The session expiration date must be in the future.",
          {
            field: "expiresAt"
          }
        );
      }
    }
  }
  resolveExpiration(expiresAt) {
    if (!expiresAt) {
      return new Date(Date.now() + DEFAULT_SESSION_TTL_MS);
    }
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
      throw ApprovaErrors.invalidRequest(
        "The session expiration date is invalid.",
        {
          field: "expiresAt"
        }
      );
    }
    return date;
  }
  toPublicSession(session) {
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
      metadata: session.metadata
    };
  }
  createDeepLink(input) {
    const url = new URL("approva://session");
    url.searchParams.set("session", input.sessionId);
    return url.toString();
  }
};

// src/authorization/AuthorizationService.ts
var AuthorizationService = class {
  constructor(http) {
    this.http = http;
  }
  http;
  async create(input) {
    return this.http.post(
      "/v1/authorization/requests",
      input
    );
  }
  async get(requestId) {
    return this.http.get(
      `/v1/authorization/requests/${encodeURIComponent(requestId)}`
    );
  }
  async getResponse(requestId) {
    return this.http.get(
      `/v1/authorization/requests/${encodeURIComponent(requestId)}/response`
    );
  }
  async cancel(requestId) {
    await this.http.delete(
      `/v1/authorization/requests/${encodeURIComponent(requestId)}`
    );
  }
};
var DEFAULT_SESSION_TTL_MS2 = 30 * 24 * 60 * 60 * 1e3;
function hashToken(token) {
  return crypto$1.createHash("sha256").update(token).digest("hex");
}
function sessionKey2(appId, sessionId) {
  return `session:${appId}:${sessionId}`;
}
var LocalSessionService = class {
  constructor(storage, ttlMs = DEFAULT_SESSION_TTL_MS2) {
    this.storage = storage;
    this.ttlMs = ttlMs;
  }
  storage;
  ttlMs;
  /** Call after WebAuthnService.finishAuthentication() succeeds. */
  async create(input) {
    const token = crypto$1.randomBytes(32).toString("base64url");
    const id = crypto$1.randomBytes(16).toString("base64url");
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    const stored = {
      id,
      appId: input.appId,
      userId: input.userId,
      deviceId: input.deviceId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      tokenHash: hashToken(token)
    };
    await this.storage.set(sessionKey2(input.appId, id), stored, this.ttlMs);
    const { tokenHash: _drop, ...session } = stored;
    return { session, token: `${id}.${token}` };
  }
  /** Validate a token handed back by the browser (e.g. an Authorization header). */
  async validate(appId, token) {
    const [id, secret] = token.split(".");
    if (!id || !secret) return null;
    const stored = await this.storage.get(sessionKey2(appId, id));
    if (!stored) return null;
    if (new Date(stored.expiresAt).getTime() < Date.now()) return null;
    if (stored.tokenHash !== hashToken(secret)) return null;
    const { tokenHash: _drop, ...session } = stored;
    return session;
  }
  async revoke(appId, sessionId) {
    await this.storage.delete(sessionKey2(appId, sessionId));
  }
};
function deviceKey(appId, deviceId) {
  return `device:${appId}:${deviceId}`;
}
function deviceIndexPrefix(appId, userId) {
  return `device:${appId}:user:${userId}:`;
}
var DeviceService = class {
  constructor(storage) {
    this.storage = storage;
  }
  storage;
  async register(input) {
    const device = {
      id: crypto$1.randomUUID(),
      appId: input.appId,
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter,
      transports: input.transports,
      name: input.name,
      status: "active",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.storage.set(deviceKey(input.appId, device.id), device);
    await this.storage.set(
      `device:${input.appId}:credential:${input.credentialId}`,
      device.id
    );
    await this.storage.set(
      `${deviceIndexPrefix(input.appId, input.userId)}${device.id}`,
      device.id
    );
    return device;
  }
  async getById(appId, deviceId) {
    return this.storage.get(deviceKey(appId, deviceId));
  }
  async getByCredentialId(appId, credentialId) {
    const deviceId = await this.storage.get(
      `device:${appId}:credential:${credentialId}`
    );
    if (!deviceId) return null;
    return this.getById(appId, deviceId);
  }
  async listForUser(appId, userId) {
    const deviceIds = await this.storage.list(
      deviceIndexPrefix(appId, userId)
    );
    const devices = await Promise.all(
      deviceIds.map((id) => this.getById(appId, id))
    );
    return devices.filter((d) => d !== null);
  }
  async updateCounter(appId, deviceId, counter) {
    const device = await this.getById(appId, deviceId);
    if (!device) return;
    device.counter = counter;
    device.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.storage.set(deviceKey(appId, deviceId), device);
  }
  async revoke(appId, deviceId) {
    const device = await this.getById(appId, deviceId);
    if (!device) return;
    device.status = "revoked";
    await this.storage.set(deviceKey(appId, deviceId), device);
  }
};
var CHALLENGE_TTL_MS = 5 * 60 * 1e3;
function registrationChallengeKey(appId, userId) {
  return `webauthn:challenge:registration:${appId}:${userId}`;
}
function authenticationChallengeKey(sessionId) {
  return `webauthn:challenge:authentication:${sessionId}`;
}
var WebAuthnService = class {
  constructor(config, storage, devices) {
    this.config = config;
    this.storage = storage;
    this.devices = devices;
  }
  config;
  storage;
  devices;
  /**
   * Step 1:
   * Generate WebAuthn registration options for a user.
   */
  async beginRegistration(input) {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId"
      });
    }
    if (!input.deviceName?.trim()) {
      throw ApprovaErrors.invalidRequest("A deviceName is required.", {
        field: "deviceId"
      });
    }
    let existingDevices;
    const userHandle = crypto.randomUUID();
    try {
      existingDevices = await this.devices.listForUser(
        input.appId,
        input.userId
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the user's registered devices.",
        code: "APPROVA_DEVICE_NOT_FOUND" /* DEVICE_NOT_FOUND */,
        status: 500,
        details: {
          appId: input.appId,
          userId: input.userId
        },
        cause: error
      });
    }
    let options;
    console.log("lets begin");
    try {
      options = await server.generateRegistrationOptions({
        rpName: this.config.rpName,
        rpID: this.config.rpID,
        userID: new TextEncoder().encode(userHandle),
        userName: input.userName,
        userDisplayName: "Approva User",
        attestationType: "none",
        excludeCredentials: existingDevices.filter((device) => device.status === "active").map((device) => ({
          id: device.credentialId,
          transports: device.transports
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required"
        }
      });
      console.log({ options });
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to generate the WebAuthn registration challenge.",
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        status: 500,
        cause: error
      });
    }
    try {
      await this.storage.set(
        registrationChallengeKey(input.appId, input.userId),
        options.challenge,
        CHALLENGE_TTL_MS
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to store the WebAuthn registration challenge.",
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        status: 500,
        cause: error
      });
    }
    return options;
  }
  /**
   * Step 2:
   * Verify WebAuthn registration and register the device.
   */
  async finishRegistration(input) {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId"
      });
    }
    if (!input.userId?.trim()) {
      throw ApprovaErrors.invalidRequest("A user ID is required.", {
        field: "userId"
      });
    }
    if (!input.response) {
      throw ApprovaErrors.invalidRequest(
        "A WebAuthn registration response is required.",
        {
          field: "response"
        }
      );
    }
    let expectedChallenge;
    try {
      expectedChallenge = await this.storage.get(
        registrationChallengeKey(input.appId, input.userId)
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the WebAuthn registration challenge.",
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        status: 500,
        cause: error
      });
    }
    if (!expectedChallenge) {
      throw new ApprovaServerError({
        message: "The WebAuthn registration challenge has expired or could not be found.",
        code: "WEBAUTHN_CHALLENGE_MISSING" /* WEBAUTHN_CHALLENGE_MISSING */,
        status: 410,
        details: {
          appId: input.appId,
          userId: input.userId
        }
      });
    }
    let verification;
    try {
      verification = await server.verifyRegistrationResponse({
        response: input.response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "WebAuthn registration verification failed.",
        code: "APPROVA_WEBAUTHN_VERIFICATION_FAILED" /* WEBAUTHN_VERIFICATION_FAILED */,
        status: 401,
        details: {
          appId: input.appId,
          userId: input.userId
        },
        cause: error
      });
    }
    try {
      await this.storage.delete(
        registrationChallengeKey(input.appId, input.userId)
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to remove the consumed WebAuthn registration challenge.",
        code: "APPROVA_INTERNAL_ERROR" /* INTERNAL_ERROR */,
        status: 500,
        cause: error
      });
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new ApprovaServerError({
        message: "WebAuthn registration could not be verified.",
        code: "WEBAUTHN_NOT_VERIFIED" /* WEBAUTHN_NOT_VERIFIED */,
        status: 401,
        details: {
          appId: input.appId,
          userId: input.userId
        }
      });
    }
    const { credential } = verification.registrationInfo;
    if (!credential?.id || !credential.publicKey) {
      throw new ApprovaServerError({
        message: "The WebAuthn registration did not contain a valid credential.",
        code: "APPROVA_WEBAUTHN_CREDENTIAL_INVALID" /* WEBAUTHN_CREDENTIAL_INVALID */,
        status: 401
      });
    }
    try {
      return await this.devices.register({
        appId: input.appId,
        userId: input.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports,
        name: input.deviceName
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to register the trusted device.",
        code: "APPROVA_DEVICE_REGISTRATION_FAILED" /* DEVICE_REGISTRATION_FAILED */,
        status: 500,
        details: {
          appId: input.appId,
          userId: input.userId
        },
        cause: error
      });
    }
  }
  /**
   * Step 1:
   * Generate authentication options for an
   * existing Approva session.
   *
   * The authentication challenge is stored against
   * sessionId so multiple authentication requests
   * for the same user cannot overwrite each other's
   * challenges.
   *
   * userId is optional because discoverable
   * credentials/passkeys can be used.
   */
  async beginAuthentication(input) {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId"
      });
    }
    if (!input.sessionId?.trim()) {
      throw ApprovaErrors.invalidRequest("A session ID is required.", {
        field: "sessionId"
      });
    }
    if (!input.deviceId?.trim()) {
      throw ApprovaErrors.invalidRequest("A device ID is required.", {
        field: "sessionId"
      });
    }
    let activeDevices = [];
    if (input.userId) {
      let devices;
      try {
        devices = await this.devices.listForUser(input.appId, input.userId);
      } catch (error) {
        throw new ApprovaServerError({
          message: "Failed to retrieve the user's trusted devices.",
          code: "APPROVA_DEVICE_NOT_FOUND" /* DEVICE_NOT_FOUND */,
          status: 500,
          details: {
            appId: input.appId,
            userId: input.userId
          },
          cause: error
        });
      }
      activeDevices = devices.filter((device) => device.status === "active");
    }
    let options;
    try {
      options = await server.generateAuthenticationOptions({
        rpID: this.config.rpID,
        userVerification: "required",
        ...activeDevices.length > 0 ? {
          allowCredentials: activeDevices.map((device) => ({
            id: device.credentialId,
            transports: device.transports
          }))
        } : {}
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to generate the WebAuthn authentication challenge.",
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        status: 500,
        cause: error
      });
    }
    try {
      await this.storage.set(
        authenticationChallengeKey(input.sessionId),
        options.challenge,
        CHALLENGE_TTL_MS
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to store the WebAuthn authentication challenge.",
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        status: 500,
        cause: error
      });
    }
    return options;
  }
  /**
   * Step 2:
   * Verify the WebAuthn authentication response
   * for an existing Approva session.
   *
   * This method proves that the registered device
   * authenticated successfully.
   *
   * Session state should be updated by the
   * session/authorization layer after this method
   * succeeds.
   */
  async finishAuthentication(input) {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId"
      });
    }
    if (!input.sessionId?.trim()) {
      throw ApprovaErrors.invalidRequest("A session ID is required.", {
        field: "sessionId"
      });
    }
    if (!input.response) {
      throw ApprovaErrors.invalidRequest(
        "A WebAuthn authentication response is required.",
        {
          field: "response"
        }
      );
    }
    let expectedChallenge;
    try {
      expectedChallenge = await this.storage.get(
        authenticationChallengeKey(input.sessionId)
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the WebAuthn authentication challenge.",
        code: "APPROVA_WEBAUTHN_CHALLENGE_FAILED" /* WEBAUTHN_CHALLENGE_FAILED */,
        status: 500,
        cause: error
      });
    }
    if (!expectedChallenge) {
      throw new ApprovaServerError({
        message: "The WebAuthn authentication challenge has expired or could not be found.",
        code: "WEBAUTHN_CHALLENGE_MISSING" /* WEBAUTHN_CHALLENGE_MISSING */,
        status: 410,
        details: {
          appId: input.appId,
          sessionId: input.sessionId
        }
      });
    }
    const response = input.response;
    if (!response.id) {
      throw new ApprovaServerError({
        message: "The WebAuthn authentication response does not contain a credential ID.",
        code: "APPROVA_WEBAUTHN_CREDENTIAL_INVALID" /* WEBAUTHN_CREDENTIAL_INVALID */,
        status: 400
      });
    }
    let device;
    try {
      device = await this.devices.getByCredentialId(input.appId, response.id);
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the WebAuthn device credential.",
        code: "APPROVA_DEVICE_NOT_FOUND" /* DEVICE_NOT_FOUND */,
        status: 500,
        cause: error
      });
    }
    if (!device || device.status !== "active") {
      throw new ApprovaServerError({
        message: "The WebAuthn device credential is unknown or has been revoked.",
        code: "WEBAUTHN_UNKNOWN_DEVICE" /* WEBAUTHN_UNKNOWN_DEVICE */,
        status: 401,
        details: {
          credentialId: response.id
        }
      });
    }
    let verification;
    try {
      verification = await server.verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID,
        credential: {
          id: device.credentialId,
          publicKey: Buffer.from(device.publicKey, "base64url"),
          counter: device.counter,
          transports: device.transports
        }
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "WebAuthn authentication verification failed.",
        code: "APPROVA_WEBAUTHN_VERIFICATION_FAILED" /* WEBAUTHN_VERIFICATION_FAILED */,
        status: 401,
        details: {
          appId: input.appId,
          sessionId: input.sessionId,
          credentialId: response.id
        },
        cause: error
      });
    }
    if (!verification.verified) {
      throw new ApprovaServerError({
        message: "WebAuthn authentication could not be verified.",
        code: "WEBAUTHN_NOT_VERIFIED" /* WEBAUTHN_NOT_VERIFIED */,
        status: 401,
        details: {
          appId: input.appId,
          sessionId: input.sessionId,
          credentialId: response.id
        }
      });
    }
    try {
      await this.storage.delete(authenticationChallengeKey(input.sessionId));
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to remove the consumed WebAuthn authentication challenge.",
        code: "APPROVA_INTERNAL_ERROR" /* INTERNAL_ERROR */,
        status: 500,
        cause: error
      });
    }
    try {
      await this.devices.updateCounter(
        input.appId,
        device.id,
        verification.authenticationInfo.newCounter
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to update the WebAuthn credential counter.",
        code: "APPROVA_INTERNAL_ERROR" /* INTERNAL_ERROR */,
        status: 500,
        details: {
          deviceId: device.id
        },
        cause: error
      });
    }
    return device;
  }
};
var MemoryStorageAdapter = class {
  filePath;
  /**
   * Prevents multiple initialization calls
   * within the same process.
   */
  initialized = false;
  /**
   * Ensures writes happen sequentially.
   *
   * This prevents two concurrent set/delete operations
   * from reading the same old file and overwriting
   * each other's changes.
   */
  writeQueue = Promise.resolve();
  constructor(filePath = "./data/approva-storage.json") {
    this.filePath = path__default.default.resolve(filePath);
  }
  /**
   * Initialize the storage file.
   *
   * IMPORTANT:
   * If the file already exists, it is NEVER overwritten.
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    await fs.promises.mkdir(path__default.default.dirname(this.filePath), {
      recursive: true
    });
    try {
      await fs.promises.access(this.filePath);
    } catch {
      await fs.promises.writeFile(this.filePath, JSON.stringify({}, null, 2), "utf8");
    }
    this.initialized = true;
  }
  /**
   * Read the complete storage file.
   *
   * This method NEVER removes records.
   */
  async readStore() {
    await this.initialize();
    const content = await fs.promises.readFile(this.filePath, "utf8");
    if (!content.trim()) {
      return {};
    }
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse Approva storage file: ${this.filePath}`,
        {
          cause: error
        }
      );
    }
  }
  /**
   * Write the complete storage file.
   */
  async writeStore(store) {
    await this.initialize();
    const temporaryFile = `${this.filePath}.tmp`;
    await fs.promises.writeFile(temporaryFile, JSON.stringify(store, null, 2), "utf8");
    await fs.promises.rename(temporaryFile, this.filePath);
  }
  /**
   * Execute writes sequentially.
   *
   * This is important because multiple asynchronous
   * requests can call set/delete at the same time.
   */
  async queueWrite(operation) {
    const next = this.writeQueue.then(operation);
    this.writeQueue = next.catch(() => void 0);
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
  async get(key) {
    const store = await this.readStore();
    const entry = store[key];
    if (!entry) {
      return null;
    }
    return entry.value;
  }
  /**
   * Create or update a record.
   *
   * Existing records are preserved.
   *
   * Calling set() for one key only changes that key;
   * every other stored record remains untouched.
   */
  async set(key, value, ttlMs) {
    await this.queueWrite(async () => {
      const store = await this.readStore();
      store[key] = {
        value,
        ...ttlMs !== void 0 ? {
          expiresAt: Date.now() + ttlMs
        } : {}
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
  async delete(key) {
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
  async list(prefix) {
    const store = await this.readStore();
    const results = [];
    for (const [key, entry] of Object.entries(store)) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      results.push(entry.value);
    }
    return results;
  }
};
var RelyingPartySchema = zod.z.object({
  name: zod.z.string().min(1),
  id: zod.z.string().min(1),
  // registrable domain, e.g. "approva"
  origin: zod.z.string().url()
  // e.g. "https://approva.io"
});
ApprovaServerConfigSchema.extend({
  rp: RelyingPartySchema
});
var ApprovaServer = class {
  sessions;
  // remote — Approva-hosted authorization sessions
  authorization;
  // remote — blockchain authorization requests
  devices;
  // local — trusted device registry
  webauthn;
  // local — WebAuthn ceremonies
  localSessions;
  // local — merchant-backend sessions
  constructor(options) {
    const config = createServerConfig(options);
    const rp = RelyingPartySchema.parse(options.rp);
    const storage = options.storage ?? new MemoryStorageAdapter();
    const http = new HttpClient({
      baseUrl: config.apiUrl,
      timeoutMs: config.requestTimeoutMs
    });
    this.authorization = new AuthorizationService(http);
    this.devices = new DeviceService(storage);
    this.webauthn = new WebAuthnService(
      { rpName: rp.name, rpID: rp.id, origin: rp.origin },
      storage,
      this.devices
    );
    this.localSessions = new LocalSessionService(storage);
    const sessionRepository = new SessionRepository(storage);
    this.sessions = new SessionService(
      sessionRepository,
      this.webauthn,
      this.devices
    );
  }
};

// src/transactions/TransactionService.ts
var TransactionService = class {
  constructor(http) {
    this.http = http;
  }
  http;
  async authorize(input) {
    return this.http.post(
      "/v1/transactions/authorize",
      input
    );
  }
  async get(requestId) {
    return this.http.get(
      `/v1/transactions/${encodeURIComponent(requestId)}`
    );
  }
  async submit(requestId, signature) {
    return this.http.post(
      `/v1/transactions/${encodeURIComponent(requestId)}/submit`,
      {
        signature
      }
    );
  }
};

// src/events/EventEmitter.ts
var ApprovaEventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(type, listener) {
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
    };
  }
  async emit(event) {
    const listeners = this.listeners.get(event.type);
    if (!listeners) {
      return;
    }
    await Promise.all(Array.from(listeners).map((listener) => listener(event)));
  }
  removeAllListeners() {
    this.listeners.clear();
  }
};

// src/adapters/base/BaseAdapter.ts
var BaseAdapter = class {
  constructor(provider) {
    this.provider = provider;
  }
  provider;
  chainId = 8453;
  getChainId() {
    return this.chainId;
  }
  async validateTransaction(transaction) {
    if (transaction.chainId !== 8453) {
      throw new Error(
        `Invalid chain ID. Expected Base mainnet (8453), received ${transaction.chainId}`
      );
    }
    if (!transaction.to) {
      throw new Error("Transaction recipient is required");
    }
  }
  async submitTransaction(signedTransaction) {
    const result = await this.provider.send("eth_sendRawTransaction", [
      signedTransaction.rawTransaction
    ]);
    return String(result);
  }
  async waitForConfirmation(transactionHash) {
    while (true) {
      const result = await this.provider.send("eth_getTransactionReceipt", [
        transactionHash
      ]);
      if (result) {
        const receipt = result;
        return {
          transactionHash,
          blockNumber: Number.parseInt(receipt.blockNumber, 16),
          status: receipt.status === "0x1" ? "success" : "reverted"
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
};

exports.ApprovaEventEmitter = ApprovaEventEmitter;
exports.ApprovaServer = ApprovaServer;
exports.ApprovaServerConfigSchema = ApprovaServerConfigSchema;
exports.ApprovaServerError = ApprovaServerError;
exports.AuthorizationService = AuthorizationService;
exports.BaseAdapter = BaseAdapter;
exports.ServerEnvironmentSchema = ServerEnvironmentSchema;
exports.SessionService = SessionService;
exports.TransactionService = TransactionService;
exports.createServerConfig = createServerConfig;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map