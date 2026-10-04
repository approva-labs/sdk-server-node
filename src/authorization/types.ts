export type AuthorizationRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface CreateAuthorizationRequestInput {
  sessionId: string;

  /**
   * Human-readable action.
   */
  action: string;

  /**
   * What the user sees in Approva.
   */
  description: string;

  /**
   * Transaction information.
   */
  transaction?: {
    to: string;
    value?: string;
    data?: string;
  };

  /**
   * Chain-specific transaction metadata.
   */
  chain: {
    network: "base";
    chainId: number;
  };

  /**
   * Optional merchant metadata.
   */
  metadata?: Record<string, unknown>;

  expiresInSeconds?: number;
}

export interface AuthorizationRequest {
  id: string;

  sessionId: string;

  status: AuthorizationRequestStatus;

  action: string;

  description: string;

  transaction?: {
    to: string;
    value?: string;
    data?: string;
  };

  chain: {
    network: "base";
    chainId: number;
  };

  createdAt: string;

  expiresAt: string;
}

export interface AuthorizationResponse {
  requestId: string;

  status: "approved" | "rejected";

  signature?: string;

  signer?: string;

  transactionHash?: string;

  approvedAt?: string;

  rejectionReason?: string;
}
