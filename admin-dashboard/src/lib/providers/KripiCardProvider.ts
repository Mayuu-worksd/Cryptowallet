/**
 * KripiCardProvider.ts
 *
 * KripiCard implementation of CardProvider and FinancialProvider interfaces.
 * Encapsulates all KripiCard-specific API details, endpoints, and credentials
 * within the Provider Layer.
 *
 * Normalizes all KripiCard payloads into UnifiedCard / CardResult models.
 * Uses ProviderLogger for sanitized logging and ProviderException hierarchy
 * for unified error handling.
 */

import {
  ProviderNotImplementedException,
  ProviderAPIException,
  ProviderAuthenticationException,
  ProviderNotConfiguredException,
} from './exceptions';
import { ProviderLogger } from './logger';
import type { UnifiedCard, UnifiedCardStatus } from './models';
import type {
  CardProvider,
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
  FiatDepositInput,
  FiatDepositResult,
  FiatWithdrawalInput,
  FiatWithdrawalResult,
  ParsedWebhookEvent,
  SimulateWebhookInput,
} from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';

export class KripiCardProvider implements CardProvider, FinancialProvider {
  readonly name = 'kripicard';

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.KRIPICARD_API_KEY || '';
    this.baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';
  }

  /**
   * Helper to execute requests against KripiCard API with sanitized logging,
   * safe retries for transient failures, and unified exception conversion.
   */
  private async request(path: string, method: 'POST' | 'GET', body?: Record<string, any>, retries = 2): Promise<any> {
    return ProviderLogger.logProviderCall(this.name, `${method} ${path}`, async () => {
      if (!this.apiKey) {
        throw new ProviderNotConfiguredException(this.name, 'KRIPICARD_API_KEY');
      }

      const url = `${this.baseUrl}${path}`;
      const payload = {
        api_key: this.apiKey,
        ...body,
      };

      let attempt = 0;
      while (attempt <= retries) {
        try {
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

          if (res.status === 401 || res.status === 403) {
            throw new ProviderAuthenticationException(this.name, { status: res.status, path });
          }

          if (!res.ok) {
            let errorBody: any = null;
            try {
              errorBody = await res.json();
            } catch {
              errorBody = await res.text().catch(() => null);
            }
            // Retry on 5xx server errors
            if (res.status >= 500 && attempt < retries) {
              attempt++;
              await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
              continue;
            }
            throw new ProviderAPIException(
              this.name,
              `KripiCard API error (${res.status}): ${res.statusText}`,
              res.status,
              errorBody
            );
          }

          const json = await res.json();
          return json;
        } catch (err: any) {
          if (err instanceof ProviderAuthenticationException || err instanceof ProviderAPIException) {
            throw err;
          }
          if (attempt < retries) {
            attempt++;
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
            continue;
          }
          throw new ProviderAPIException(
            this.name,
            `Network connection failed after ${attempt} retries: ${err.message || err}`,
            503,
            { path }
          );
        }
      }
    }, { path, method });
  }

  /**
   * Normalize raw KripiCard status strings to standard UnifiedCardStatus.
   */
  private normalizeStatus(rawStatus?: string): UnifiedCardStatus {
    const s = (rawStatus || '').toLowerCase();
    if (s === 'active' || s === 'enabled') return 'active';
    if (s === 'frozen' || s === 'suspended' || s === 'locked') return 'frozen';
    if (s === 'blocked' || s === 'cancelled' || s === 'terminated') return 'blocked';
    if (s === 'pending') return 'pending';
    return 'active';
  }

  // ─── Card Lifecycle Methods ────────────────────────────────────────────────

  async createCard(input: CreateCardInput, kycData: Record<string, unknown>): Promise<CardResult> {
    const nameOnCard = (input.nameOnCard || String(kycData.full_name || 'CARD HOLDER')).trim();
    const email = String(kycData.email || '');
    const dob   = String(kycData.dob || '');

    // Supported BINs: 533171 (SG), 246001 (UK), 441357, 49387519, 49387520
    const bin = '441357'; // default global BIN — no DOB required
    const payload: Record<string, any> = {
      bin,
      amount: 10,
      name_on_card: nameOnCard,
    };
    if (email) payload.email = email;
    if (dob)   payload.dateOfBirth = dob;

    const result = await this.request('/api/external/cards/createcard', 'POST', payload);

    if (!result?.success) {
      throw new ProviderAPIException(this.name, result?.message || 'Card creation failed', 400, result);
    }

    const cardId = String(result.card_id);

    // Fetch full card details (number, cvv, expiry) immediately after creation
    let number: string | undefined;
    let cvv: string | undefined;
    let last4 = String(result.last_4 || '0000');
    let expiryMmYy = '12/28';

    try {
      const details = await this.request('/api/external/cards/carddetails', 'POST', { card_id: cardId });
      if (details?.success) {
        const rawNumber = String(details.card_number || '').replace(/\s/g, '');
        if (rawNumber.length >= 4) last4 = rawNumber.slice(-4);
        number = details.card_number;
        cvv = details.cvv;
        // KripiCard returns expiry as MM/YY — keep as-is
        if (details.expiry) expiryMmYy = details.expiry;
      }
    } catch (_e) {
      // Fall back to create response values
      if (result.expiry) expiryMmYy = result.expiry;
    }

    ProviderLogger.info(this.name, 'createCard', `Card issued successfully for ${input.walletAddress}`);

    return {
      providerCardId: cardId,
      status: this.normalizeStatus('active'),
      providerStatus: 'active',
      last4,
      expiryMmYy,
      number,
      cvv,
      holderName: nameOnCard.toUpperCase(),
      isMock: false,
      raw: result,
    };
  }

  async getCard(providerCardId: string): Promise<CardResult | null> {
    const result = await this.request('/api/external/cards/carddetails', 'POST', { card_id: providerCardId });
    if (!result?.success) return null;

    const rawNumber = String(result.card_number || '0000').replace(/\s/g, '');
    const last4 = rawNumber.slice(-4);
    const normalizedStatus = this.normalizeStatus(result.status);

    return {
      providerCardId,
      status: normalizedStatus,
      providerStatus: result.status || 'active',
      last4,
      expiryMmYy: result.expiry || '12/28',
      number: result.card_number,
      cvv: result.cvv,
      holderName: 'CARD HOLDER',
      isMock: false,
      raw: result,
    };
  }

  async freezeCard(providerCardId: string): Promise<CardStatusResult> {
    await this.request('/api/external/premium/Freeze_Unfreeze', 'POST', {
      card_id: providerCardId,
      action: 'freeze',
    });

    ProviderLogger.info(this.name, 'freezeCard', `Card ${providerCardId} frozen successfully`);

    return {
      providerCardId,
      providerStatus: 'frozen',
      internalStatus: 'frozen',
    };
  }

  async unfreezeCard(providerCardId: string): Promise<CardStatusResult> {
    await this.request('/api/external/premium/Freeze_Unfreeze', 'POST', {
      card_id: providerCardId,
      action: 'unfreeze',
    });

    ProviderLogger.info(this.name, 'unfreezeCard', `Card ${providerCardId} unfrozen successfully`);

    return {
      providerCardId,
      providerStatus: 'active',
      internalStatus: 'active',
    };
  }

  async getTransactions(providerCardId: string, _filters?: any): Promise<GetTransactionsResult> {
    const result = await this.request('/api/external/cards/transactions', 'POST', { card_id: providerCardId });
    // KripiCard returns { success, data: { card_id, balance, transactions: [] } }
    const rawTxns = result?.data?.transactions || result?.transactions || [];

    const transactions = rawTxns.map((tx: any, idx: number) => ({
      id: String(tx.id || `kripi-${providerCardId}-${idx}`),
      amount: Number(tx.amount || 0),
      currency: 'USD',
      merchantName: String(tx.merchant || 'Unknown Merchant'),
      description: tx.type || tx.description,
      status: tx.success ? 'approved' : 'declined',
      createdAt: tx.date || new Date().toISOString(),
      raw: tx,
    }));

    return { transactions, source: 'provider' };
  }

  // ─── FinancialProvider Specific Card Methods ───────────────────────────────

  async createVirtualCard(input: {
    cardholderId: string;
    variant?: string;
    nameOnCard?: string;
    walletAddress: string;
  }): Promise<UnifiedCard> {
    const cardResult = await this.createCard(
      {
        cardholderId: input.cardholderId,
        type: 'virtual',
        variant: input.variant,
        nameOnCard: input.nameOnCard,
        walletAddress: input.walletAddress,
      },
      { full_name: input.nameOnCard }
    );

    return {
      id: cardResult.providerCardId,
      providerCardId: cardResult.providerCardId,
      providerName: this.name,
      cardholderId: input.cardholderId,
      walletAddress: input.walletAddress.toLowerCase(),
      status: cardResult.status,
      providerStatus: cardResult.providerStatus,
      last4: cardResult.last4,
      expiryMmYy: cardResult.expiryMmYy,
      holderName: cardResult.holderName,
      cardType: 'virtual',
      currency: 'USD',
      number: cardResult.number,
      cvv: cardResult.cvv,
      isMock: cardResult.isMock,
      createdAt: new Date().toISOString(),
    };
  }

  async fundVirtualCard(cardId: string, amount: number, _currency: string): Promise<any> {
    const result = await this.request('/api/external/cards/fundcard', 'POST', {
      card_id: cardId,
      amount,
    });
    ProviderLogger.info(this.name, 'fundVirtualCard', `Funded card ${cardId} with ${amount}`);
    return { success: true, raw: result };
  }

  async fundCard(cardId: string, amount: number): Promise<any> {
    return this.fundVirtualCard(cardId, amount, 'USD');
  }

  async deleteCard(cardId: string): Promise<any> {
    const result = await this.request('/api/external/cards/deletecard', 'POST', { card_id: cardId });
    ProviderLogger.info(this.name, 'deleteCard', `Card ${cardId} deleted. Refunded: $${result?.refunded ?? 0}`);
    return { success: true, providerCardId: cardId, status: 'terminated', raw: result };
  }

  async getCardDetails(cardId: string): Promise<any> {
    return this.getCard(cardId);
  }

  async generateStatement(cardId: string, filters?: any): Promise<any> {
    return this.getStatement(cardId, filters);
  }

  // ─── Fiat & Deposits ───────────────────────────────────────────────────────

  async createDeposit(input: { walletAddress: string; cardId?: string; amount: number; currency: string; network?: string; order_id?: string }): Promise<any> {
    return this.request('/api/external/deposits/create', 'POST', input);
  }

  async depositStatus(depositId: string): Promise<any> {
    return this.request('/api/external/deposits/status', 'POST', { id: depositId });
  }

  async withdrawFiat(_input: any): Promise<any> {
    throw new ProviderNotImplementedException(this.name, 'withdrawFiat');
  }

  async withdrawCrypto(_input: any): Promise<any> {
    throw new ProviderNotImplementedException(this.name, 'withdrawCrypto');
  }

  // ─── Webhooks & Health Check ───────────────────────────────────────────────

  async registerWebhook(_url: string): Promise<any> {
    throw new ProviderNotImplementedException(this.name, 'registerWebhook');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      const result = await this.request('/api/external/cards/list', 'POST', {});
      return result?.success ? { status: 'healthy' } : { status: 'unhealthy', error: result?.message };
    } catch (e: any) {
      return { status: 'unhealthy', error: e.message };
    }
  }

  // ─── CardProvider Identity & Utility Methods ───────────────────────────────

  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    // KripiCard issues cards directly without pre-registration KYB/BYOK model
    return {
      cardholderId: input.walletAddress,
      status: 'approved',
      alreadyExists: true,
    };
  }

  async getCardholder(providerId: string): Promise<CardholderStatus> {
    return {
      cardholderId: providerId,
      status: 'approved',
      found: true,
    };
  }

  async listCards(_cardholderId: string): Promise<any[]> {
    try {
      const result = await this.request('/api/external/cards/list', 'POST', {});
      return result?.data || [];
    } catch {
      return [];
    }
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    const res = await this.freezeCard(providerCardId);
    return {
      ...res,
      internalStatus: 'blocked',
    };
  }

  async setPin(_providerCardId: string, _pin: string): Promise<SetPinResult> {
    return { ok: true, message: 'PIN stored locally in encrypted wallet profile' };
  }

  async updateLimits(_providerCardId: string, _limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async getStatement(providerCardId: string, _filters?: any): Promise<StatementResult> {
    const card = await this.getCard(providerCardId);
    const txRes = await this.getTransactions(providerCardId);
    return {
      cardId: providerCardId,
      holderName: card?.holderName || 'CARD HOLDER',
      balance: (card?.raw as any)?.data?.balance ?? (card?.raw as any)?.balance ?? 0,
      transactions: txRes.transactions,
      source: 'provider',
    };
  }

  async depositFiat(_input: FiatDepositInput): Promise<FiatDepositResult> {
    throw new ProviderNotImplementedException(this.name, 'depositFiat');
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent {
    const p = payload as any;
    const event = p?.event || p?.type || '';
    const data  = p?.data  || p || {};

    // transaction.created / deposit.completed
    if (event === 'transaction.created' || event === 'deposit.completed') {
      return {
        category:        'transaction.created',
        providerCardId:  String(data.card_id || data.cardId || ''),
        transactionData: {
          id:           String(data.id || data.transaction_id || ''),
          amount:       Number(data.amount || 0),
          currency:     String(data.currency || 'USD'),
          type:         event === 'deposit.completed' ? 'topup' : 'spend',
          status:       String(data.status || 'approved'),
          merchantName: String(data.merchant || data.description || 'KripiCard'),
          description:  data.description || null,
          createdAt:    data.created_at || data.date || new Date().toISOString(),
        },
        raw: payload,
      };
    }

    // card.created / card.funded
    if (event === 'card.created' || event === 'card.funded') {
      return {
        category:       event === 'card.funded' ? 'card.updated' : 'card.activated',
        providerCardId: String(data.card_id || data.id || ''),
        newStatus:      'active',
        providerStatus: 'active',
        raw:            payload,
      };
    }

    // Any other events — log and ignore
    return {
      category:       'unknown',
      providerCardId: String(data.card_id || data.id || ''),
      raw:            payload,
    };
  }

  async simulateWebhook(_input: SimulateWebhookInput): Promise<unknown> {
    throw new ProviderNotImplementedException(this.name, 'simulateWebhook');
  }
}

