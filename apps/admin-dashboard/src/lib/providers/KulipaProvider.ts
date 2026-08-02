/**
 * KulipaProvider.ts
 *
 * Placeholder adapter for Kulipa provider.
 * Throws ProviderNotImplementedException for all unimplemented methods.
 */

import { ProviderNotImplementedException } from './exceptions';
import type { CardProvider, CardholderInput, CardholderResult, CardholderStatus, CreateCardInput, CardResult, CardStatusResult, SetPinResult, UpdateLimitsInput, GetTransactionsResult, StatementResult, FiatDepositInput, FiatDepositResult, FiatWithdrawalInput, FiatWithdrawalResult, ParsedWebhookEvent, SimulateWebhookInput } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class KulipaProvider implements CardProvider, FinancialProvider {
  readonly name = 'kulipa';

  // ─── FinancialProvider Methods ─────────────────────────────────────────────

  async createVirtualCard(input: any): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'createVirtualCard');
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'fundVirtualCard');
  }

  async freezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'freezeCard');
  }

  async unfreezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'unfreezeCard');
  }

  async deleteCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'deleteCard');
  }

  async getCardDetails(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'getCardDetails');
  }

  async createDeposit(input: any): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'createDeposit');
  }

  async depositStatus(depositId: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'depositStatus');
  }

  async withdrawCrypto(input: any): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'withdrawCrypto');
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'generateStatement');
  }

  async registerWebhook(url: string): Promise<any> {
    throw new ProviderNotImplementedException('kulipa', 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    throw new ProviderNotImplementedException('kulipa', 'healthCheck');
  }

  // ─── CardProvider Methods ───────────────────────────────────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    throw new ProviderNotImplementedException('kulipa', 'registerCardholder');
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    throw new ProviderNotImplementedException('kulipa', 'getCardholder');
  }

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    throw new ProviderNotImplementedException('kulipa', 'createCard');
  }

  async listCards(cardholderId: string): Promise<CardResult[]> {
    throw new ProviderNotImplementedException('kulipa', 'listCards');
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    throw new ProviderNotImplementedException('kulipa', 'getCard');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    throw new ProviderNotImplementedException('kulipa', 'blockCard');
  }

  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    throw new ProviderNotImplementedException('kulipa', 'setPin');
  }

  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    throw new ProviderNotImplementedException('kulipa', 'updateLimits');
  }

  async getTransactions(providerCardId: string, filters?: any): Promise<GetTransactionsResult> {
    throw new ProviderNotImplementedException('kulipa', 'getTransactions');
  }

  async getStatement(providerCardId: string, filters?: any): Promise<StatementResult> {
    throw new ProviderNotImplementedException('kulipa', 'getStatement');
  }

  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException('kulipa', 'depositFiat');
  }

  async withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult> {
    throw new ProviderNotImplementedException('kulipa', 'withdrawFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    throw new ProviderNotImplementedException('kulipa', 'parseWebhook');
  }

  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException('kulipa', 'simulateWebhook');
  }
}
