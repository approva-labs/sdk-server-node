import type { HttpClient } from "../http/HttpClient.js";

import type { CreateTransactionInput, TransactionResult } from "./types.js";

export class TransactionService {
  constructor(private readonly http: HttpClient) {}

  async authorize(input: CreateTransactionInput): Promise<TransactionResult> {
    return this.http.post<TransactionResult>(
      "/v1/transactions/authorize",
      input
    );
  }

  async get(requestId: string): Promise<TransactionResult> {
    return this.http.get<TransactionResult>(
      `/v1/transactions/${encodeURIComponent(requestId)}`
    );
  }

  async submit(
    requestId: string,
    signature: string
  ): Promise<TransactionResult> {
    return this.http.post<TransactionResult>(
      `/v1/transactions/${encodeURIComponent(requestId)}/submit`,
      {
        signature,
      }
    );
  }
}
