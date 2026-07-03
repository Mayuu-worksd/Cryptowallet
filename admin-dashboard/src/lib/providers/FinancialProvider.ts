/**
 * FinancialProvider.ts
 *
 * Interface that all financial service providers must implement.
 * Ensures provider interchangeability without rewriting business logic.
 */

export interface FinancialProvider {
  readonly name: string;

  /** Issue a new virtual card */
  createVirtualCard(input: {
    cardholderId: string;
    variant?: string;
    nameOnCard?: string;
    walletAddress: string;
  }): Promise<any>;

  /** Fund a virtual card with a specific amount */
  fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any>;

  /** Freeze a card temporarily */
  freezeCard(cardId: string): Promise<any>;

  /** Unfreeze a frozen card */
  unfreezeCard(cardId: string): Promise<any>;

  /** Delete or permanently terminate a card */
  deleteCard(cardId: string): Promise<any>;

  /** Retrieve all cards associated with a cardholder */
  listCards(cardholderId: string): Promise<any[]>;

  /** Fetch sensitive details for a card (PAN, CVV, expiry, balance) */
  getCardDetails(cardId: string): Promise<any>;

  /** Get historical transactions for a card */
  getTransactions(cardId: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<any>;

  /** Create deposit instructions (e.g. SEPA/Wire details) */
  createDeposit(input: {
    walletAddress: string;
    cardId?: string;
    amount: number;
    currency: string;
  }): Promise<any>;

  /** Query status of a specific fiat deposit */
  depositStatus(depositId: string): Promise<any>;

  /** Initiate a fiat withdrawal to a bank account */
  withdrawFiat(input: {
    walletAddress: string;
    cardId?: string;
    amount: number;
    currency: string;
    destinationIban: string;
    destinationBic: string;
    destinationName: string;
  }): Promise<any>;

  /** Initiate a cryptocurrency withdrawal */
  withdrawCrypto(input: {
    walletAddress: string;
    amount: number;
    token: string;
    destinationAddress: string;
  }): Promise<any>;

  /** Generate an account statement */
  generateStatement(cardId: string, filters?: { startDate?: string; endDate?: string }): Promise<any>;

  /** Register webhook endpoints with the provider */
  registerWebhook(url: string): Promise<any>;

  /** Perform a connectivity/health check against the provider's API */
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }>;
}
