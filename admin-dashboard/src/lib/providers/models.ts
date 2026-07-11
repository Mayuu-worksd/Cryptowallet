/**
 * models.ts
 *
 * Unified domain models for the Provider Abstraction Layer.
 * All providers (KripiCard, Codego, Rain, Striga, etc.) normalize their responses
 * into these standardized internal structures.
 *
 * React Native mobile app and general backend routes only communicate using
 * these unified models.
 */

export type UnifiedCardStatus = 'active' | 'frozen' | 'blocked' | 'pending' | 'terminated';
export type UnifiedCardType = 'virtual' | 'physical';

/**
 * UnifiedCard
 * Standardized provider-independent representation of a payment card.
 * Sensitive data (full PAN, CVV) is only returned at initial creation/issuance
 * and never persisted in database.
 */
export interface UnifiedCard {
  id: string;                      // Internal system identifier
  providerCardId: string;          // Provider's unique card ID
  providerName: string;            // Name of provider ('kripicard', 'codego', etc.)
  cardholderId: string;            // Provider cardholder ID
  walletAddress: string;           // Associated user wallet address (lowercase)
  status: UnifiedCardStatus;       // Normalized status
  providerStatus: string;          // Raw status string from provider
  last4: string;                   // Last 4 digits of card number
  expiryMmYy: string;              // MM/YY formatted expiration date
  holderName: string;              // Name embossed on card
  cardType: UnifiedCardType;       // 'virtual' | 'physical'
  currency: string;                // Default card currency (e.g., 'USD')
  balance?: number;                // Current card balance (if supported/queried)
  number?: string;                 // Full PAN (only present immediately upon issuance)
  cvv?: string;                    // CVV code (only present immediately upon issuance)
  isMock: boolean;                 // True if generated in local/sandbox fallback mode
  createdAt?: string;              // ISO timestamp
  metadata?: Record<string, unknown>; // Non-sensitive provider-specific metadata
}

/**
 * UnifiedCardholder
 * Standardized representation of a KYC-verified cardholder identity.
 */
export interface UnifiedCardholder {
  cardholderId: string;            // Provider's internal cardholder ID
  providerName: string;
  walletAddress: string;
  status: 'approved' | 'pending' | 'rejected' | 'requires_action';
  providerStatus: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  alreadyExists: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * UnifiedTransaction
 * Standardized transaction record returned across all card providers.
 */
export interface UnifiedTransaction {
  id: string;                      // Provider transaction ID
  providerCardId: string;
  amount: number;
  currency: string;
  status: 'approved' | 'pending' | 'declined' | 'settled' | 'reversed';
  providerStatus: string;
  merchantName: string;
  merchantCategoryCode?: string;
  description?: string;
  type: 'purchase' | 'refund' | 'atm' | 'fee' | 'adjustment';
  createdAt: string;               // ISO 8601 timestamp
  settledAt?: string;
}

/**
 * UnifiedErrorDetail
 * Standardized error representation across all provider operations.
 */
export interface UnifiedApiError {
  code: string;                    // Machine-readable error code (e.g. 'PROVIDER_API_ERROR')
  message: string;                 // Human-readable explanation
  provider?: string;               // Name of provider involved
  statusCode?: number;             // HTTP status code
  details?: unknown;               // Sanitized additional diagnostics
}

/**
 * UnifiedApiResponse<T>
 * Standardized wrapper envelope for all Provider Layer backend responses.
 * Mobile app consumes this consistent schema regardless of underlying provider.
 */
export interface UnifiedApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: UnifiedApiError;
  meta: {
    provider: string;
    timestamp: string;
    isMock?: boolean;
    requestId?: string;
  };
}

/**
 * Helper to construct a successful UnifiedApiResponse envelope.
 */
export function createSuccessResponse<T>(
  data: T,
  providerName: string,
  options?: { isMock?: boolean; requestId?: string }
): UnifiedApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      provider: providerName,
      timestamp: new Date().toISOString(),
      isMock: options?.isMock ?? false,
      requestId: options?.requestId,
    },
  };
}

/**
 * Helper to construct a failed UnifiedApiResponse envelope.
 */
export function createErrorResponse(
  error: { code: string; message: string; statusCode?: number; details?: unknown },
  providerName: string = 'system',
  options?: { requestId?: string }
): UnifiedApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      provider: providerName,
      statusCode: error.statusCode,
      details: error.details,
    },
    meta: {
      provider: providerName,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    },
  };
}
