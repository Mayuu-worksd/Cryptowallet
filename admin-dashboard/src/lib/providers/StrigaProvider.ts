/**
 * StrigaProvider.ts
 *
 * Placeholder adapter for Striga provider.
 * Throws ProviderNotImplementedException for all unimplemented methods.
 */

import { ProviderNotImplementedException } from './exceptions';
import type { CardProvider, CardholderInput, CardholderResult, CardholderStatus, CreateCardInput, CardResult, CardStatusResult, SetPinResult, UpdateLimitsInput, GetTransactionsResult, StatementResult, FiatDepositInput, FiatDepositResult, FiatWithdrawalInput, FiatWithdrawalResult, ParsedWebhookEvent, SimulateWebhookInput } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class StrigaProvider implements CardProvider, FinancialProvider {
  readonly name = 'striga';

  // ─── FinancialProvider Methods ─────────────────────────────────────────────

  async createVirtualCard(input: any): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'createVirtualCard');
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'fundVirtualCard');
  }

  async freezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'freezeCard');
  }

  async unfreezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'unfreezeCard');
  }

  async deleteCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'deleteCard');
  }

  async getCardDetails(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'getCardDetails');
  }

  async createDeposit(input: any): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'createDeposit');
  }

  async depositStatus(depositId: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'depositStatus');
  }

  async withdrawCrypto(input: any): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'withdrawCrypto');
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'generateStatement');
  }

  async registerWebhook(url: string): Promise<any> {
    throw new ProviderNotImplementedException('striga', 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    throw new ProviderNotImplementedException('striga', 'healthCheck');
  }

  // ─── CardProvider Methods ───────────────────────────────────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    throw new ProviderNotImplementedException('striga', 'registerCardholder');
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    throw new ProviderNotImplementedException('striga', 'getCardholder');
  }

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    throw new ProviderNotImplementedException('striga', 'createCard');
  }

  async listCards(cardholderId: string): Promise<CardResult[]> {
    throw new ProviderNotImplementedException('striga', 'listCards');
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    throw new ProviderNotImplementedException('striga', 'getCard');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    throw new ProviderNotImplementedException('striga', 'blockCard');
  }

  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    throw new ProviderNotImplementedException('striga', 'setPin');
  }

  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    throw new ProviderNotImplementedException('striga', 'updateLimits');
  }

  async getTransactions(providerCardId: string, filters?: any): Promise<GetTransactionsResult> {
    throw new ProviderNotImplementedException('striga', 'getTransactions');
  }

  async getStatement(providerCardId: string, filters?: any): Promise<StatementResult> {
    throw new ProviderNotImplementedException('striga', 'getStatement');
  }

  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException('striga', 'depositFiat');
  }

  async withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult> {
    throw new ProviderNotImplementedException('striga', 'withdrawFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    throw new ProviderNotImplementedException('striga', 'parseWebhook');
  }

  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException('striga', 'simulateWebhook');
  }
}
