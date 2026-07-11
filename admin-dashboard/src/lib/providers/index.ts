/**
 * providers/index.ts
 *
 * Barrel export for the Provider Abstraction Layer.
 * Import from here, not from individual files:
 *
 *   import { getCardProvider, ProviderLogger, createSuccessResponse } from '@/lib/providers';
 *   import type { UnifiedCard, UnifiedApiResponse, CardProvider, FinancialProvider } from '@/lib/providers';
 */

// Unified Domain Models & API Response Envelopes
export type {
  UnifiedCard,
  UnifiedCardStatus,
  UnifiedCardType,
  UnifiedCardholder,
  UnifiedTransaction,
  UnifiedApiError,
  UnifiedApiResponse,
} from './models';

export {
  createSuccessResponse,
  createErrorResponse,
} from './models';

// Unified Exception Hierarchy
export {
  ProviderException,
  ProviderNotConfiguredException,
  ProviderNotImplementedException,
  ProviderAuthenticationException,
  ProviderAPIException,
  ProviderKYCException,
  ProviderRateLimitException,
  ProviderCardNotFoundException,
  normalizeProviderError,
} from './exceptions';

// Structured Logger
export { ProviderLogger, sanitizeLogData } from './logger';

// Legacy CardProvider Interface + all shared types
export type {
  CardProvider,
  CardStatus,
  CardholderInput,
  CardholderResult,
  CardholderStatus,
  CreateCardInput,
  CardResult,
  CardStatusResult,
  SetPinResult,
  UpdateLimitsInput,
  GetTransactionsResult,
  StatementResult,
  TransactionFilters,
  FiatDepositInput,
  FiatDepositResult,
  FiatWithdrawalInput,
  FiatWithdrawalResult,
  ParsedWebhookEvent,
  WebhookEventCategory,
  SimulateWebhookInput,
  ProviderTransaction,
} from './CardProvider';

// New FinancialProvider Interface
export type { FinancialProvider } from './FinancialProvider';

// Provider implementations
export { CodegoProvider } from './CodegoProvider';
export { KripiCardProvider } from './KripiCardProvider';
export { RainProvider } from './RainProvider';
export { StrigaProvider } from './StrigaProvider';
export { PintoPayProvider } from './PintoPayProvider';
export { KulipaProvider } from './KulipaProvider';
export { FutureProvider } from './FutureProvider';

// Provider Manager & Factory (primary entry point for route handlers)
export { ProviderManager, getCardProvider, resetCardProvider } from './ProviderManager';
export type { UnifiedProvider } from './ProviderManager';
