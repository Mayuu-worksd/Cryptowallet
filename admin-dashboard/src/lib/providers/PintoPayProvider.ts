/**
 * PintoPayProvider.ts
 *
 * Placeholder adapter for PintoPay provider.
 * Throws ProviderNotImplementedException for all unimplemented methods.
 */

import { ProviderNotImplementedException } from './exceptions';
import type { CardProvider, CardholderInput, CardholderResult, CardholderStatus, CreateCardInput, CardResult, CardStatusResult, SetPinResult, UpdateLimitsInput, GetTransactionsResult, StatementResult, FiatDepositInput, FiatDepositResult, FiatWithdrawalInput, FiatWithdrawalResult, ParsedWebhookEvent, SimulateWebhookInput } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class PintoPayProvider implements CardProvider, FinancialProvider {
  readonly name = 'pintopay';

  // ─── FinancialProvider Methods ─────────────────────────────────────────────

  async createVirtualCard(input: any): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'createVirtualCard');
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'fundVirtualCard');
  }

  async freezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'freezeCard');
  }

  async unfreezeCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'unfreezeCard');
  }

  async deleteCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'deleteCard');
  }

  async getCardDetails(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'getCardDetails');
  }

  async createDeposit(input: any): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'createDeposit');
  }

  async depositStatus(depositId: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'depositStatus');
  }

  async withdrawCrypto(input: any): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'withdrawCrypto');
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'generateStatement');
  }

  async registerWebhook(url: string): Promise<any> {
    throw new ProviderNotImplementedException('pintopay', 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    throw new ProviderNotImplementedException('pintopay', 'healthCheck');
  }

  // ─── CardProvider Methods ───────────────────────────────────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    throw new ProviderNotImplementedException('pintopay', 'registerCardholder');
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    throw new ProviderNotImplementedException('pintopay', 'getCardholder');
  }

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    throw new ProviderNotImplementedException('pintopay', 'createCard');
  }

  async listCards(cardholderId: string): Promise<CardResult[]> {
    throw new ProviderNotImplementedException('pintopay', 'listCards');
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    throw new ProviderNotImplementedException('pintopay', 'getCard');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    throw new ProviderNotImplementedException('pintopay', 'blockCard');
  }

  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    throw new ProviderNotImplementedException('pintopay', 'setPin');
  }

  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    throw new ProviderNotImplementedException('pintopay', 'updateLimits');
  }

  async getTransactions(providerCardId: string, filters?: any): Promise<GetTransactionsResult> {
    throw new ProviderNotImplementedException('pintopay', 'getTransactions');
  }

  async getStatement(providerCardId: string, filters?: any): Promise<StatementResult> {
    throw new ProviderNotImplementedException('pintopay', 'getStatement');
  }

  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException('pintopay', 'depositFiat');
  }

  async withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult> {
    throw new ProviderNotImplementedException('pintopay', 'withdrawFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    throw new ProviderNotImplementedException('pintopay', 'parseWebhook');
  }

  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException('pintopay', 'simulateWebhook');
  }
}
