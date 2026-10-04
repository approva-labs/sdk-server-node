// file: src/http/HttpClient.ts

import axios, { type AxiosError, type AxiosInstance } from "axios";

import { ApprovaServerError } from "../errors/ApprovaServerError.js";

import { ApprovaErrorCode } from "../errors/ApprovaErrorCode.js";

import { isApprovaErrorCode } from "../errors/isApprovaErrorCode.js";

export interface HttpClientOptions {
  baseUrl: string;
  serverKey?: string;
  timeoutMs: number;
}

interface ApprovaApiErrorResponse {
  message?: unknown;
  code?: unknown;
  details?: unknown;
}

export class HttpClient {
  private readonly client: AxiosInstance;

  constructor(private readonly options: HttpClientOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.serverKey}`,
      },
    });
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private resolveUrl(path: string): string {
    return `${this.options.baseUrl.replace(/\/+$/, "")}/${path.replace(
      /^\/+/,
      ""
    )}`;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data: body,
      });

      return response.data;
    } catch (error: unknown) {
      throw this.toApprovaServerError(error, path);
    }
  }

  private toApprovaServerError(
    error: unknown,
    path: string
  ): ApprovaServerError {
    if (error instanceof ApprovaServerError) {
      return error;
    }

    const url = this.resolveUrl(path);

    /**
     * Axios error.
     */
    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error, url);
    }

    /**
     * Unknown/non-Axios error.
     */
    return new ApprovaServerError({
      message: `${
        error instanceof Error ? error.message : "Approva request failed."
      } (${url})`,

      code: ApprovaErrorCode.NETWORK_ERROR,

      details: error,

      cause: error,
    });
  }

  private handleAxiosError(
    error: AxiosError<ApprovaApiErrorResponse>,
    url: string
  ): ApprovaServerError {
    /**
     * The request was created but the server
     * never returned an HTTP response.
     *
     * This covers:
     * - timeout
     * - DNS failure
     * - connection refused
     * - network interruption
     */
    if (!error.response) {
      const isTimeout =
        error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";

      if (isTimeout) {
        return new ApprovaServerError({
          message: `Approva request timed out. (${url})`,

          code: ApprovaErrorCode.REQUEST_TIMEOUT,

          status: 408,

          details: error.toJSON?.() ?? error,

          cause: error,
        });
      }

      return new ApprovaServerError({
        message: `${
          error.message || "Approva network request failed."
        } (${url})`,

        code: ApprovaErrorCode.NETWORK_ERROR,

        details: error.toJSON?.() ?? error,

        cause: error,
      });
    }

    /**
     * Server returned an HTTP response.
     */
    const status = error.response.status;

    const data = error.response.data;

    const message = this.extractMessage(data, status, url);

    const code = this.extractErrorCode(data);

    return new ApprovaServerError({
      message,

      code,

      status,

      details: this.extractDetails(data),

      cause: error,
    });
  }

  private extractMessage(data: unknown, status: number, url: string): string {
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as ApprovaApiErrorResponse).message;

      if (typeof message === "string" && message.trim()) {
        return `${message} (${url})`;
      }
    }

    return `Approva request failed with status ${status}. (${url})`;
  }

  private extractErrorCode(data: unknown): ApprovaErrorCode | any {
    if (data && typeof data === "object" && "code" in data) {
      const value = (data as ApprovaApiErrorResponse).code;

      if (isApprovaErrorCode(value)) {
        return value;
      }
    }

    /**
     * The server returned an unknown
     * or missing error code.
     *
     * Never trust arbitrary strings as
     * ApprovaErrorCode.
     */
    return ApprovaErrorCode.HTTP_ERROR;
  }

  private extractDetails(data: unknown): unknown {
    if (data && typeof data === "object" && "details" in data) {
      return (data as ApprovaApiErrorResponse).details;
    }

    return data;
  }
}
