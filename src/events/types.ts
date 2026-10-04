export type ApprovaEvent =
  | {
      type: "session.created";
      sessionId: string;
    }
  | {
      type: "session.connected";
      sessionId: string;
      deviceId: string;
    }
  | {
      type: "session.revoked";
      sessionId: string;
    }
  | {
      type: "authorization.created";
      requestId: string;
      sessionId: string;
    }
  | {
      type: "authorization.approved";
      requestId: string;
      sessionId: string;
      signer?: string;
    }
  | {
      type: "authorization.rejected";
      requestId: string;
      sessionId: string;
      reason?: string;
    }
  | {
      type: "transaction.submitted";
      requestId: string;
      transactionHash: string;
    }
  | {
      type: "transaction.confirmed";
      requestId: string;
      transactionHash: string;
    }
  | {
      type: "transaction.failed";
      requestId: string;
      reason?: string;
    };
