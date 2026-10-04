import { ApprovaErrorCode } from "./ApprovaErrorCode.js";

export interface ApprovaServerErrorParams {
  message: string;
  code: ApprovaErrorCode;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

export class ApprovaServerError extends Error {
  readonly code: ApprovaErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(params: ApprovaServerErrorParams) {
    super(params.message, {
      cause: params.cause,
    });

    this.name = "ApprovaServerError";
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;

    Object.setPrototypeOf(this, ApprovaServerError.prototype);
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
      details: this.details,
    };
  }

  /**
   * Creates an ApprovaServerError from an unknown
   * thrown value.
   */
  static from(
    error: unknown,
    fallback: {
      code?: ApprovaErrorCode;
      message?: string;
      status?: number;
    } = {}
  ): ApprovaServerError {
    if (error instanceof ApprovaServerError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApprovaServerError({
        message:
          fallback.message ??
          error.message ??
          "An unknown Approva server error occurred.",
        code: fallback.code ?? ApprovaErrorCode.UNKNOWN_ERROR,
        status: fallback.status,
        cause: error,
      });
    }

    return new ApprovaServerError({
      message: fallback.message ?? "An unknown Approva server error occurred.",
      code: fallback.code ?? ApprovaErrorCode.UNKNOWN_ERROR,
      status: fallback.status,
      details: error,
    });
  }
}

export { ApprovaErrorCode };
