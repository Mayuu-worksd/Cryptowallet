/**
 * providers/index.ts
 *
 * Barrel export for the provider abstraction layer.
 * Import from here, not from individual files:
 *
 *   import { getCardProvider } from '@/lib/providers';
 *   import type { CardProvider, FinancialProvider } from '@/lib/providers';
 */

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

// Custom Exceptions
export { ProviderNotConfiguredException, ProviderNotImplementedException } from './exceptions';

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
