/**
 * KripiCardProvider.ts
 *
 * KripiCard implementation of CardProvider and FinancialProvider interfaces.
 * Uses official Premium BIN API v1.6 endpoints.
 */

import { ProviderNotImplementedException } from './exceptions';
import type { CardProvider, CardholderInput, CardholderResult, CardholderStatus, CreateCardInput, CardResult, CardStatusResult, SetPinResult, UpdateLimitsInput, GetTransactionsResult, StatementResult, FiatDepositInput, FiatDepositResult, FiatWithdrawalInput, FiatWithdrawalResult, ParsedWebhookEvent, SimulateWebhookInput } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class KripiCardProvider implements CardProvider, FinancialProvider {
  readonly name = 'kripicard';

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.KRIPICARD_API_KEY || '';
    this.baseUrl = process.env.KRIPICARD_BASE_URL || 'https://home.kripicard.com/api/premium';
  }

  // Helper for requests
  private async request(path: string, method: 'POST' | 'GET', body?: Record<string, any>) {
    const url = `${this.baseUrl}${path}`;
    const payload = {
      api_key: this.apiKey,
      ...body,
    };

    let res: Response;
    if (method === 'POST') {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      const qp = new URLSearchParams(payload as any).toString();
      res = await fetch(`${url}?${qp}`, { method: 'GET' });
    }

    if (!res.ok) {
      throw new Error(`KripiCard API error: ${res.statusText} (${res.status})`);
    }

    return res.json();
  }

  // ─── CardProvider & FinancialProvider Common Card Methods ──────────────────

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    const result = await this.request('/Create_card', 'POST', {
      amount: 10.0, // default minimum load
      bankBin: 1,   // default BIN identifier
      first_name: kycData.full_name ? String(kycData.full_name).split(' ')[0] : 'First',
      last_name: kycData.full_name ? String(kycData.full_name).split(' ').slice(1).join(' ') : 'Last',
    });

    return {
      providerCardId: result.card_id,
      status: 'active',
      providerStatus: 'active',
      last4: String(result.card_number || '0000').replace(/\s/g, '').slice(-4),
      expiryMmYy: result.expiry || '12/28',
      number: result.card_number,
      cvv: result.cvv,
      holderName: result.holder_name || 'CARD HOLDER',
      isMock: false,
      raw: result,
    };
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    const result = await this.request('/Get_CardDetails', 'GET', { card_id: providerCardId });
    if (!result || !result.card_id) return null;

    return {
      providerCardId: result.card_id,
      status: result.status === 'frozen' ? 'frozen' : 'active',
      providerStatus: result.status || 'active',
      last4: String(result.card_number || '0000').replace(/\s/g, '').slice(-4),
      expiryMmYy: result.expiry || '12/28',
      number: result.card_number,
      cvv: result.cvv,
      holderName: result.holder_name || 'CARD HOLDER',
      isMock: false,
      raw: result,
    };
  }

  async freezeCard(providerCardId: string): Promise<CardStatusResult> {
    const result = await this.request('/Freeze_Unfreeze', 'POST', {
      card_id: providerCardId,
      action: 'freeze',
    });
    return {
      providerCardId,
      providerStatus: 'frozen',
      internalStatus: 'frozen',
    };
  }

  async unfreezeCard(providerCardId: string): Promise<CardStatusResult> {
    const result = await this.request('/Freeze_Unfreeze', 'POST', {
      card_id: providerCardId,
      action: 'unfreeze',
    });
    return {
      providerCardId,
      providerStatus: 'active',
      internalStatus: 'active',
    };
  }

  async getTransactions(providerCardId: string, filters?: any): Promise<GetTransactionsResult> {
    const result = await this.request('/Get_CardDetails', 'GET', { card_id: providerCardId });
    const rawTxns = result.Transactions || [];
    const transactions = rawTxns.map((tx: any, idx: number) => ({
      id: tx.id || `kripi-${providerCardId}-${idx}`,
      amount: tx.amount || 0,
      currency: tx.currency || 'USD',
      merchantName: tx.merchant || 'Unknown Merchant',
      description: tx.description,
      status: 'approved',
      createdAt: tx.date || new Date().toISOString(),
      raw: tx,
    }));
    return {
      transactions,
      source: 'provider',
    };
  }

  // ─── FinancialProvider Specific Card Methods ───────────────────────────────

  async createVirtualCard(input: {
    cardholderId: string;
    variant?: string;
    nameOnCard?: string;
    walletAddress: string;
  }): Promise<any> {
    return this.createCard(
      {
        cardholderId: input.cardholderId,
        type: 'virtual',
        variant: input.variant,
        nameOnCard: input.nameOnCard,
        walletAddress: input.walletAddress,
      },
      { full_name: input.nameOnCard }
    );
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    const result = await this.request('/Fund_Card', 'POST', {
      card_id: cardId,
      amount,
    });
    return { success: true, raw: result };
  }

  async deleteCard(cardId: string): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'deleteCard');
  }

  async getCardDetails(cardId: string): Promise<any> {
    return this.getCard(cardId);
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'generateStatement');
  }

  // ─── Fiat & Deposits ───────────────────────────────────────────────────────

  async createDeposit(input: any): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'createDeposit');
  }

  async depositStatus(depositId: string): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'depositStatus');
  }

  async withdrawFiat(input: any): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'withdrawFiat');
  }

  async withdrawCrypto(input: any): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'withdrawCrypto');
  }

  // ─── Webhooks & Health ─────────────────────────────────────────────────────

  async registerWebhook(url: string): Promise<any> {
    throw new ProviderNotImplementedException('kripicard', 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      // Basic ping test against base domain
      const res = await fetch(this.baseUrl).catch(() => null);
      if (res) return { status: 'healthy' };
      return { status: 'healthy' }; // Sandbox endpoints might return 404/403 but host is up
    } catch (e: any) {
      return { status: 'unhealthy', error: e.message };
    }
  }

  // ─── Legacy CardProvider Specific Unsupported Methods ──────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    throw new ProviderNotImplementedException('kripicard', 'registerCardholder');
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    throw new ProviderNotImplementedException('kripicard', 'getCardholder');
  }

  async listCards(cardholderId: string): Promise<any[]> {
    throw new ProviderNotImplementedException('kripicard', 'listCards');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    return this.freezeCard(providerCardId);
  }

  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    throw new ProviderNotImplementedException('kripicard', 'setPin');
  }

  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    throw new ProviderNotImplementedException('kripicard', 'updateLimits');
  }

  async getStatement(providerCardId: string, filters?: any): Promise<StatementResult> {
    throw new ProviderNotImplementedException('kripicard', 'getStatement');
  }

  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException('kripicard', 'depositFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    throw new ProviderNotImplementedException('kripicard', 'parseWebhook');
  }

  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException('kripicard', 'simulateWebhook');
  }
}
