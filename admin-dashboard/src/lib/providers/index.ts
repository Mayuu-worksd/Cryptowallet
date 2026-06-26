/**
 * providers/index.ts
 *
 * Barrel export for the provider abstraction layer.
 * Import from here, not from individual files:
 *
 *   import { getCardProvider } from '@/lib/providers';
 *   import type { CardProvider, CardResult } from '@/lib/providers';
 */

// Interface + all shared types
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

// Provider implementations
export { CodegoProvider } from './CodegoProvider';

// Factory (primary entry point for route handlers)
export { getCardProvider, resetCardProvider } from './ProviderFactory';
