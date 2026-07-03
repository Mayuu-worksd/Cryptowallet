/**
 * RainProvider.ts
 *
 * Placeholder adapter for Rain provider.
 * Throws ProviderNotImplementedException for all unimplemented methods.
 */

import { ProviderNotImplementedException } from './exceptions';
import type { CardProvider, CardholderInput, CardholderResult, CardholderStatus, CreateCardInput, CardResult, CardStatusResult, SetPinResult, UpdateLimitsInput, GetTransactionsResult, StatementResult, FiatDepositInput, FiatDepositResult, FiatWithdrawalInput, FiatWithdrawalResult, ParsedWebhookEvent, SimulateWebhookInput } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class RainProvider implements CardProvider, FinancialProvider {
  readonly name = 'rain';

  // ─── FinancialProvider Methods ─────────────────────────────────────────────

  async createVirtualCard(input: any): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'createVirtualCard');
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'fundVirtualCard');
  }

  async freezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'freezeCard');
  }

  async unfreezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'unfreezeCard');
  }

  async deleteCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'deleteCard');
  }

  async getCardDetails(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'getCardDetails');
  }

  async createDeposit(input: any): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'createDeposit');
  }

  async depositStatus(depositId: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'depositStatus');
  }

  async withdrawCrypto(input: any): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'withdrawCrypto');
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'generateStatement');
  }

  async registerWebhook(url: string): Promise<any> {
    throw new ProviderNotImplementedException('rain', 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    throw new ProviderNotImplementedException('rain', 'healthCheck');
  }

  // ─── CardProvider Methods ───────────────────────────────────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    throw new ProviderNotImplementedException('rain', 'registerCardholder');
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    throw new ProviderNotImplementedException('rain', 'getCardholder');
  }

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    throw new ProviderNotImplementedException('rain', 'createCard');
  }

  async listCards(cardholderId: string): Promise<CardResult[]> {
    throw new ProviderNotImplementedException('rain', 'listCards');
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    throw new ProviderNotImplementedException('rain', 'getCard');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    throw new ProviderNotImplementedException('rain', 'blockCard');
  }

  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    throw new ProviderNotImplementedException('rain', 'setPin');
  }

  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    throw new ProviderNotImplementedException('rain', 'updateLimits');
  }

  async getTransactions(providerCardId: string, filters?: any): Promise<GetTransactionsResult> {
    throw new ProviderNotImplementedException('rain', 'getTransactions');
  }

  async getStatement(providerCardId: string, filters?: any): Promise<StatementResult> {
    throw new ProviderNotImplementedException('rain', 'getStatement');
  }

  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException('rain', 'depositFiat');
  }

  async withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult> {
    throw new ProviderNotImplementedException('rain', 'withdrawFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    throw new ProviderNotImplementedException('rain', 'parseWebhook');
  }

  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException('rain', 'simulateWebhook');
  }
}
