/**
 * CardProvider.ts
 *
 * Generic interface that any Card-as-a-Service provider must implement.
 * CryptoWallet only speaks this interface — it knows nothing about Codego,
 * Stripe Issuing, Lithic, Marqeta, etc.
 *
 * To swap providers:
 *   1. Implement this interface in a new XyzProvider class
 *   2. Register it in ProviderFactory.ts
 *   3. Set CARD_PROVIDER=xyz in .env
 *   4. Done — zero changes to routes, mobile app, or business logic
 */

// ─── Normalised status values used throughout the wallet ─────────────────────
export type CardStatus = 'active' | 'frozen' | 'blocked' | 'pending' | 'terminated';

// ─── Cardholder (KYC identity) ────────────────────────────────────────────────
export interface CardholderInput {
  walletAddress: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;          // YYYY-MM-DD
  phone: string;
  phoneCountryCode?: string;
  ipAddress: string;
  address: {
    line1: string;
    city: string;
    postalCode: string;
    countryCode: string;       // ISO 3166-1 alpha-2
  };
  nationalId?: string;
  countryOfIssue?: string;
  // KYC token fields (provider-specific — pass through as-is)
  sumsubShareToken?: string;
  personaShareToken?: string;
  [key: string]: unknown;     // allow provider-specific extensions
}

export interface CardholderResult {
  cardholderId: string;       // provider's internal ID
  externalUserId?: string;
  status?: string;            // raw provider status
  alreadyExists?: boolean;
  raw?: unknown;              // full provider response, for debugging
}

export interface CardholderStatus {
  cardholderId: string;
  status: string;             // raw provider status (e.g. 'approved', 'pending')
  found: boolean;
  raw?: unknown;
}

// ─── Card creation ────────────────────────────────────────────────────────────
export interface CreateCardInput {
  cardholderId: string;       // provider cardholder ID
  type: 'virtual' | 'physical';
  variant?: string;           // e.g. 'classic', 'gold', 'platinum'
  nameOnCard?: string;
  billingAddress?: {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
  };
  walletAddress: string;      // our internal reference
}

export interface CardResult {
  providerCardId: string;     // provider's card ID (stored as codego_card_id today)
  status: CardStatus;
  providerStatus: string;     // raw status string from provider
  last4: string;
  expiryMmYy: string;         // MM/YY
  number?: string;            // full PAN (only returned at issuance)
  cvv?: string;
  holderName: string;
  isMock: boolean;            // true when generated locally (sandbox fallback)
  alreadyExists?: boolean;
  raw?: unknown;
}

// ─── Card controls ────────────────────────────────────────────────────────────
export interface CardStatusResult {
  providerCardId: string;
  providerStatus: string;     // raw provider status after the action
  internalStatus: CardStatus;
}

export interface SetPinResult {
  ok: boolean;
  message: string;
}

export interface UpdateLimitsInput {
  daily?: number;
  monthly?: number;
  currency?: string;
}

// ─── Transactions & Statements ────────────────────────────────────────────────
export interface ProviderTransaction {
  id: string;
  amount: number;
  currency: string;
  merchantName?: string;
  description?: string;
  status: string;
  type?: string;
  createdAt: string;
  raw?: unknown;
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface GetTransactionsResult {
  transactions: ProviderTransaction[];
  source: 'provider' | 'supabase_fallback' | 'supabase_seeded' | 'not_found';
  seeded?: boolean;
  note?: string;
}

export interface StatementResult {
  cardId: string;
  holderName?: string;
  balance?: number;
  transactions: ProviderTransaction[];
  source: 'provider' | 'supabase_fallback' | 'not_found';
  note?: string;
}

// ─── Fiat ─────────────────────────────────────────────────────────────────────
export interface FiatDepositInput {
  walletAddress: string;
  cardId?: string;            // provider card ID or internal UUID
  amount: number;
  currency: string;
}

export interface FiatDepositResult {
  depositRecord: unknown;     // the Supabase fiat_deposits row
  paymentInstructions: {
    bankName?: string;
    beneficiary?: string;
    accountNumber?: string;
    routingNumber?: string;
    iban?: string | null;
    swiftCode?: string | null;
    currency?: string;
    instructions?: string | null;
    reference: string;
    note?: string;
  };
}

export interface FiatWithdrawalInput {
  walletAddress: string;
  cardId?: string;
  amount: number;
  currency: string;
  destinationIban: string;
  destinationBic: string;
  destinationName: string;
}

export interface FiatWithdrawalResult {
  withdrawalRecord: unknown;  // the Supabase fiat_withdrawals row
  processedViaProvider: boolean;
  sandboxNote?: string;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export type WebhookEventCategory =
  | 'card.created' | 'card.activated' | 'card.frozen'
  | 'card.unfrozen' | 'card.blocked' | 'card.updated'
  | 'kyc.approved' | 'transaction.created' | 'transaction.updated'
  | 'transfer.completed' | 'transfer.failed'
  | 'unknown';

export interface ParsedWebhookEvent {
  category: WebhookEventCategory;
  providerCardId?: string;
  providerCardholderId?: string;
  providerTransferId?: string;
  newStatus?: CardStatus;
  providerStatus?: string;
  transactionData?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    merchantName?: string;
    description?: string;
    type?: string;
    createdAt?: string;
  };
  raw: unknown;               // original provider payload
}

export interface SimulateWebhookInput {
  eventType: string;
  providerCardId: string;
  extraData?: Record<string, unknown>;
}

// ─── The interface every provider must implement ──────────────────────────────
export interface CardProvider {
  /** Human-readable name, e.g. 'codego', 'stripe', 'lithic' */
  readonly name: string;

  // ── KYC / Identity ──────────────────────────────────────────────────────────
  registerCardholder(input: CardholderInput): Promise<CardholderResult>;
  getCardholder(providerId: string): Promise<CardholderStatus>;

  // ── Card lifecycle ───────────────────────────────────────────────────────────
  createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult>;
  listCards(cardholderId: string): Promise<CardResult[]>;
  getCard(providerCardId: string): Promise<CardResult | null>;

  // ── Card controls ────────────────────────────────────────────────────────────
  freezeCard(providerCardId: string): Promise<CardStatusResult>;
  unfreezeCard(providerCardId: string): Promise<CardStatusResult>;
  blockCard(providerCardId: string): Promise<CardStatusResult>;
  setPin(providerCardId: string, pin: string): Promise<SetPinResult>;
  updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }>;

  // ── Data ─────────────────────────────────────────────────────────────────────
  getTransactions(providerCardId: string, filters?: TransactionFilters): Promise<GetTransactionsResult>;
  getStatement(providerCardId: string, filters?: TransactionFilters): Promise<StatementResult>;

  // ── Fiat ─────────────────────────────────────────────────────────────────────
  depositFiat(input: FiatDepositInput): Promise<FiatDepositResult>;
  withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult>;

  // ── Webhooks ─────────────────────────────────────────────────────────────────
  parseWebhook(payload: unknown): ParsedWebhookEvent;
  simulateWebhook(input: SimulateWebhookInput): Promise<unknown>;
}
