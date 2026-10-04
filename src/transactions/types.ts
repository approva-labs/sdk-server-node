export interface BaseTransaction {
  to: string;

  value?: string;

  data?: string;

  gasLimit?: string;

  maxFeePerGas?: string;

  maxPriorityFeePerGas?: string;

  nonce?: number;

  chainId: 8453;
}

export interface CreateTransactionInput {
  sessionId: string;

  transaction: BaseTransaction;

  /**
   * Human-readable description presented to the user.
   */
  description: string;

  metadata?: Record<string, unknown>;
}

export interface TransactionResult {
  requestId: string;

  status:
    | "pending"
    | "approved"
    | "rejected"
    | "submitted"
    | "confirmed"
    | "failed";

  transactionHash?: string;

  signer?: string;

  signature?: string;

  blockNumber?: number;
}
