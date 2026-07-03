/**
 * FutureProvider.ts
 *
 * Placeholder adapter for Future/unspecified providers.
 * Throws ProviderNotImplementedException for all unimplemented methods.
 */

import { ProviderNotImplementedException } from './exceptions';
import type { CardProvider, CardholderInput, CardholderResult, CardholderStatus, CreateCardInput, CardResult, CardStatusResult, SetPinResult, UpdateLimitsInput, GetTransactionsResult, StatementResult, FiatDepositInput, FiatDepositResult, FiatWithdrawalInput, FiatWithdrawalResult, ParsedWebhookEvent, SimulateWebhookInput } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class FutureProvider implements CardProvider, FinancialProvider {
  readonly name = 'future';

  // ─── FinancialProvider Methods ─────────────────────────────────────────────

  async createVirtualCard(input: any): Promise<any> {
    throw new ProviderNotImplementedException('future', 'createVirtualCard');
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'fundVirtualCard');
  }

  async freezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'freezeCard');
  }

  async unfreezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'unfreezeCard');
  }

  async deleteCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'deleteCard');
  }

  async getCardDetails(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'getCardDetails');
  }

  async createDeposit(input: any): Promise<any> {
    throw new ProviderNotImplementedException('future', 'createDeposit');
  }

  async depositStatus(depositId: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'depositStatus');
  }

  async withdrawCrypto(input: any): Promise<any> {
    throw new ProviderNotImplementedException('future', 'withdrawCrypto');
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    throw new ProviderNotImplementedException('future', 'generateStatement');
  }

  async registerWebhook(url: string): Promise<any> {
    throw new ProviderNotImplementedException('future', 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    throw new ProviderNotImplementedException('future', 'healthCheck');
  }

  // ─── CardProvider Methods ───────────────────────────────────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    throw new ProviderNotImplementedException('future', 'registerCardholder');
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    throw new ProviderNotImplementedException('future', 'getCardholder');
  }

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    throw new ProviderNotImplementedException('future', 'createCard');
  }

  async listCards(cardholderId: string): Promise<CardResult[]> {
    throw new ProviderNotImplementedException('future', 'listCards');
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    throw new ProviderNotImplementedException('future', 'getCard');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    throw new ProviderNotImplementedException('future', 'blockCard');
  }

  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    throw new ProviderNotImplementedException('future', 'setPin');
  }

  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    throw new ProviderNotImplementedException('future', 'updateLimits');
  }

  async getTransactions(providerCardId: string, filters?: any): Promise<GetTransactionsResult> {
    throw new ProviderNotImplementedException('future', 'getTransactions');
  }

  async getStatement(providerCardId: string, filters?: any): Promise<StatementResult> {
    throw new ProviderNotImplementedException('future', 'getStatement');
  }

  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException('future', 'depositFiat');
  }

  async withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult> {
    throw new ProviderNotImplementedException('future', 'withdrawFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    throw new ProviderNotImplementedException('future', 'parseWebhook');
  }

  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException('future', 'simulateWebhook');
  }
}
