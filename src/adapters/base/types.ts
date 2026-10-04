export interface BaseTransactionRequest {
  to: string;

  value?: string;

  data?: string;

  gasLimit?: string;

  nonce?: number;

  chainId: 8453;
}

export interface BaseSignedTransaction {
  rawTransaction: string;

  signer: string;
}

export interface BaseTransactionReceipt {
  transactionHash: string;

  blockNumber: number;

  status: "success" | "reverted";
}

export interface BaseAdapter {
  getChainId(): number;

  validateTransaction(transaction: BaseTransactionRequest): Promise<void>;

  submitTransaction(signedTransaction: BaseSignedTransaction): Promise<string>;

  waitForConfirmation(transactionHash: string): Promise<BaseTransactionReceipt>;
}
