import { ApprovaErrorCode } from "./ApprovaErrorCode.js";

import { ApprovaServerError } from "./ApprovaServerError.js";

export const ApprovaErrors = {
  invalidRequest(message = "The request is invalid.", details?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.INVALID_REQUEST,
      message,
      status: 400,
      details,
    });
  },

  unauthorized(message = "Authentication is required.", details?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.UNAUTHORIZED,
      message,
      status: 401,
      details,
    });
  },

  forbidden(
    message = "You are not authorized to perform this operation.",
    details?: unknown
  ) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.FORBIDDEN,
      message,
      status: 403,
      details,
    });
  },

  notFound(
    message = "The requested resource was not found.",
    details?: unknown
  ) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.NOT_FOUND,
      message,
      status: 404,
      details,
    });
  },

  conflict(
    message = "The requested operation conflicts with the current state.",
    details?: unknown
  ) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.CONFLICT,
      message,
      status: 409,
      details,
    });
  },

  sessionNotFound(sessionId: string) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.SESSION_NOT_FOUND,
      message: `Session '${sessionId}' was not found.`,
      status: 404,
      details: {
        sessionId,
      },
    });
  },

  sessionExpired(sessionId: string) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.SESSION_EXPIRED,
      message: `Session '${sessionId}' has expired.`,
      status: 410,
      details: {
        sessionId,
      },
    });
  },

  sessionRevoked(sessionId: string) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.SESSION_REVOKED,
      message: `Session '${sessionId}' has been revoked.`,
      status: 410,
      details: {
        sessionId,
      },
    });
  },

  sessionInvalidState(sessionId: string, state: string) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.SESSION_INVALID_STATE,
      message: `Session '${sessionId}' cannot be used in its current state.`,
      status: 409,
      details: {
        sessionId,
        state,
      },
    });
  },

  sessionCreationFailed(cause?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.SESSION_CREATION_FAILED,
      message: "Failed to create the Approva session.",
      status: 500,
      cause,
    });
  },

  sessionCompletionFailed(cause?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.SESSION_COMPLETION_FAILED,
      message: "Failed to complete the Approva session.",
      status: 500,
      cause,
    });
  },

  apiUnavailable(cause?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.API_UNAVAILABLE,
      message: "The Approva API is unavailable.",
      status: 503,
      cause,
    });
  },

  apiRequestFailed(status?: number, details?: unknown, cause?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.API_REQUEST_FAILED,
      message: "The Approva API request failed.",
      status,
      details,
      cause,
    });
  },

  apiResponseInvalid(details?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.API_RESPONSE_INVALID,
      message: "The Approva API returned an invalid response.",
      status: 502,
      details,
    });
  },

  webauthnVerificationFailed(details?: unknown, cause?: unknown) {
    return new ApprovaServerError({
      code: ApprovaErrorCode.WEBAUTHN_VERIFICATION_FAILED,
      message: "WebAuthn verification failed.",
      status: 401,
      details,
      cause,
    });
  },
} as const;
