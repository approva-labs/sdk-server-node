import type {
  BaseAdapter as IBaseAdapter,
  BaseSignedTransaction,
  BaseTransactionReceipt,
  BaseTransactionRequest,
} from "./types.js";

export interface BaseProvider {
  send(method: string, params: unknown[]): Promise<unknown>;
}

export class BaseAdapter implements IBaseAdapter {
  public readonly chainId = 8453;

  constructor(private readonly provider: BaseProvider) {}

  getChainId(): number {
    return this.chainId;
  }

  async validateTransaction(
    transaction: BaseTransactionRequest
  ): Promise<void> {
    if (transaction.chainId !== 8453) {
      throw new Error(
        `Invalid chain ID. Expected Base mainnet (8453), received ${transaction.chainId}`
      );
    }

    if (!transaction.to) {
      throw new Error("Transaction recipient is required");
    }
  }

  async submitTransaction(
    signedTransaction: BaseSignedTransaction
  ): Promise<string> {
    const result = await this.provider.send("eth_sendRawTransaction", [
      signedTransaction.rawTransaction,
    ]);

    return String(result);
  }

  async waitForConfirmation(
    transactionHash: string
  ): Promise<BaseTransactionReceipt> {
    while (true) {
      const result = await this.provider.send("eth_getTransactionReceipt", [
        transactionHash,
      ]);

      if (result) {
        const receipt = result as {
          blockNumber: string;
          status: string;
        };

        return {
          transactionHash,
          blockNumber: Number.parseInt(receipt.blockNumber, 16),
          status: receipt.status === "0x1" ? "success" : "reverted",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}
