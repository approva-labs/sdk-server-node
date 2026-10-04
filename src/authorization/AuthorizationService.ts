import type { HttpClient } from "../http/HttpClient.js";

import type {
  AuthorizationRequest,
  AuthorizationResponse,
  CreateAuthorizationRequestInput,
} from "./types.js";

export class AuthorizationService {
  constructor(private readonly http: HttpClient) {}

  async create(
    input: CreateAuthorizationRequestInput
  ): Promise<AuthorizationRequest> {
    return this.http.post<AuthorizationRequest>(
      "/v1/authorization/requests",
      input
    );
  }

  async get(requestId: string): Promise<AuthorizationRequest> {
    return this.http.get<AuthorizationRequest>(
      `/v1/authorization/requests/${encodeURIComponent(requestId)}`
    );
  }

  async getResponse(requestId: string): Promise<AuthorizationResponse> {
    return this.http.get<AuthorizationResponse>(
      `/v1/authorization/requests/${encodeURIComponent(requestId)}/response`
    );
  }

  async cancel(requestId: string): Promise<void> {
    await this.http.delete(
      `/v1/authorization/requests/${encodeURIComponent(requestId)}`
    );
  }
}
