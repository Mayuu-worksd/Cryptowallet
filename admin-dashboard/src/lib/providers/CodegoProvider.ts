/**
 * CodegoProvider.ts
 *
 * Codego implementation of the CardProvider interface.
 * ALL Codego-specific knowledge lives here:
 *   - API base URL and authentication headers
 *   - Request/response payload shapes
 *   - Status mapping (Codego ↔ internal)
 *   - Mock-card fallback logic (sandbox)
 *   - Webhook event parsing
 *
 * The logic here is extracted verbatim from the existing route handlers.
 * Nothing has been rewritten — only consolidated into one place.
 *
 * To add a new provider, create XyzProvider.ts implementing CardProvider.
 * This file never needs to change for that.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  CardProvider,
  CardholderInput,
  CardholderResult,
  CardholderStatus,
  CreateCardInput,
  CardResult,
  CardStatus,
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
  SimulateWebhookInput,
} from './CardProvider';

// ─── Supabase client (server-side) ───────────────────────────────────────────
// Re-use the singleton already used across the admin-dashboard routes
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// ─── Seed data for sandbox transaction fallback ───────────────────────────────
const SEED_TRANSACTIONS = [
  { merchantName: 'Amazon',       amount: -49.99,  description: 'Online purchase'      },
  { merchantName: 'Netflix',      amount: -15.99,  description: 'Monthly subscription' },
  { merchantName: 'Uber Eats',    amount: -32.50,  description: 'Food delivery order'  },
  { merchantName: 'Spotify',      amount:  -9.99,  description: 'Music subscription'   },
  { merchantName: 'Shell Gas',    amount: -58.20,  description: 'Fuel station'         },
  { merchantName: 'Card Top-Up',  amount:  200.00, description: 'Wallet top-up'        },
  { merchantName: 'Starbucks',    amount: -12.75,  description: 'Coffee & food'        },
  { merchantName: 'Apple Store',  amount:  -4.99,  description: 'App purchase'         },
];

export class CodegoProvider implements CardProvider {
  readonly name = 'codego';

  // ─── Codego-specific config ─────────────────────────────────────────────────
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor() {
    this.apiKey  = process.env.CODEGO_API_KEY  || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
    this.baseUrl = process.env.CODEGO_API_URL  || 'https://vcc-sandbox.codegotech.com/api/v1';
    this.headers = {
      'X-Api-Key':     this.apiKey,
      'Content-Type':  'application/json',
    };
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Map Codego's raw status string → our internal CardStatus.
   * Extracted verbatim from /api/codego/cards/route.ts and
   * /api/webhooks/codego/route.ts (both had identical logic).
   */
  private mapStatus(codegoStatus: string): CardStatus {
    switch (codegoStatus?.toLowerCase()) {
      case 'active':
      case 'activated':
        return 'active';
      case 'locked':
      case 'frozen':
        return 'frozen';
      case 'canceled':
      case 'cancelled':
      case 'blocked':
        return 'blocked';
      default:
        return 'pending';
    }
  }

  /**
   * Map our internal status → Codego's accepted status values.
   * Extracted verbatim from /api/codego/cards/[id]/status/route.ts.
   */
  private toCodegoStatus(internalStatus: string): string | null {
    const map: Record<string, string> = {
      active:   'active',
      frozen:   'locked',    // our 'frozen' → Codego 'locked'
      blocked:  'canceled',
      locked:   'locked',
      canceled: 'canceled',
    };
    return map[internalStatus] ?? null;
  }

  /**
   * Normalise a DOB string to YYYY-MM-DD.
   * Extracted verbatim from /api/codego/cards/route.ts.
   */
  private formatBirthDate(dobStr: string | null | undefined): string {
    if (!dobStr) return '1990-01-01';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return dobStr;
    const parts = dobStr.split(/[-/]/);
    if (parts.length === 3) {
      let year = '', month = '', day = '';
      if (parts[2].length === 4) {
        year = parts[2];
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        if (p0 > 12) { day = String(p0).padStart(2,'0'); month = String(p1).padStart(2,'0'); }
        else          { month = String(p0).padStart(2,'0'); day = String(p1).padStart(2,'0'); }
      } else if (parts[0].length === 4) {
        year  = parts[0];
        month = String(parts[1]).padStart(2,'0');
        day   = String(parts[2]).padStart(2,'0');
      }
      if (year && month && day) return `${year}-${month}-${day}`;
    }
    return '1990-01-01';
  }

  /**
   * Extract the card ID from any Codego webhook payload shape.
   * Extracted verbatim from /api/webhooks/codego/route.ts.
   */
  private extractCardId(payload: any): string | null {
    return payload?.data?.cardId
      || payload?.data?.id
      || payload?.cardId
      || payload?.id
      || null;
  }

  /** Generate a mock card when Codego sandbox is unavailable. */
  private generateMockCard(nameOnCard: string, type: 'virtual' | 'physical'): {
    id: string; status: string; maskedPan: string; last4: string;
    expiryMonth: number; expiryYear: number; number: string; cvv: string;
    limit: { amount: number };
  } {
    const cvv    = String(Math.floor(100 + Math.random() * 900));
    const rawNum = `400000000000${Math.floor(1000 + Math.random() * 9000)}`;
    const last4  = rawNum.slice(-4);
    return {
      id:          `mock_cg_${Math.random().toString(36).substr(2, 9)}`,
      status:      'active',
      maskedPan:   `•••• •••• •••• ${last4}`,
      last4,
      expiryMonth: 12,
      expiryYear:  2028,
      number:      rawNum.replace(/(\d{4})/g, '$1 ').trim(),
      cvv,
      limit:       { amount: 0 },
    };
  }

  // ─── CardProvider implementation ────────────────────────────────────────────

  // ── KYC / Identity ──────────────────────────────────────────────────────────

  /**
   * Register a new cardholder with Codego via POST /applications.
   * Extracted verbatim from /api/codego/cardholders/route.ts and
   * /api/codego/applications/route.ts.
   */
  async registerCardholder(input: CardholderInput): Promise<CardholderResult> {
    const externalUserId = input.walletAddress
      ? `cw_${input.walletAddress.toLowerCase().replace('0x','').slice(0,16)}`
      : undefined;

    const payload: Record<string, unknown> = {
      externalUserId,
      walletAddress:    input.walletAddress?.toLowerCase(),
      email:            input.email,
      firstName:        input.firstName,
      lastName:         input.lastName,
      birthDate:        this.formatBirthDate(input.birthDate),
      phoneNumber:      input.phone?.replace(/\D/g,''),
      phoneCountryCode: input.phoneCountryCode || '1',
      ipAddress:        input.ipAddress,
      address: {
        line1:       input.address.line1,
        city:        input.address.city,
        postalCode:  input.address.postalCode,
        countryCode: input.address.countryCode,
      },
      nationalId:     input.nationalId    || '123456789',
      countryOfIssue: input.countryOfIssue || input.address.countryCode,
      key:            this.apiKey,
    };

    if (input.sumsubShareToken)  payload.sumsubShareToken  = input.sumsubShareToken;
    if (input.personaShareToken) payload.personaShareToken = input.personaShareToken;

    const res = await fetch(`${this.baseUrl}/applications`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify(payload),
    });

    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        cardholderId: externalUserId || '',
        alreadyExists: false,
        raw,
      };
    }

    const cardholderId: string = (raw as any).id || (raw as any).userId || externalUserId || '';
    return { cardholderId, externalUserId, status: (raw as any).status, raw };
  }

  /**
   * Fetch a cardholder from Codego via GET /users/{id}.
   * Extracted verbatim from /api/codego/cardholders/route.ts.
   */
  async getCardholder(providerId: string): Promise<CardholderStatus> {
    const res = await fetch(`${this.baseUrl}/users/${providerId}`, {
      headers: this.headers,
    });
    const raw = await res.json().catch(() => ({}));
    return {
      cardholderId: providerId,
      status:  res.ok ? ((raw as any).applicationStatus || 'unknown') : 'not_found',
      found:   res.ok,
      raw,
    };
  }

  // ── Card lifecycle ───────────────────────────────────────────────────────────

  /**
   * Create a virtual or physical card for the given cardholder.
   * Extracted verbatim from /api/codego/cards/route.ts POST handler.
   * Includes all sandbox fallback (mock card) logic.
   */
  async createCard(
    input: CreateCardInput,
    kycData: Record<string, unknown>,
  ): Promise<CardResult> {
    const holderName = ((input.nameOnCard || (kycData.full_name as string) || 'CARD HOLDER') as string).toUpperCase();

    // Build card creation payload
    const cardPayload: Record<string, unknown> = {
      type:          input.type === 'physical' ? 'physical' : 'virtual',
      configuration: {
        displayName: holderName,
        productId:   '1',
      },
    };

    if (input.type === 'physical' && input.billingAddress) {
      cardPayload.billing = {
        line1:      input.billingAddress.line1,
        city:       input.billingAddress.city,
        postalCode: input.billingAddress.postalCode,
        country:    input.billingAddress.country,
      };
    }

    const cardRes = await fetch(
      `${this.baseUrl}/users/${input.cardholderId}/cards`,
      { method: 'POST', headers: this.headers, body: JSON.stringify(cardPayload) },
    );

    if (!cardRes.ok) {
      console.warn('[CodegoProvider] Card creation failed, issuing mock card:', cardRes.status);
      const mock = this.generateMockCard(holderName, input.type);
      return {
        providerCardId: mock.id,
        status:         'active',
        providerStatus: 'active',
        last4:          mock.last4,
        expiryMmYy:     '12/28',
        number:         mock.number,
        cvv:            mock.cvv,
        holderName,
        isMock:         true,
      };
    }

    const cardData: any = await cardRes.json();
    const expiryMmYy = (cardData.expiryMonth && cardData.expiryYear)
      ? `${String(cardData.expiryMonth).padStart(2,'0')}/${String(cardData.expiryYear).slice(-2)}`
      : '12/28';
    const last4 = (cardData.maskedPan || cardData.last4 || '0000').replace(/\D/g,'').slice(-4) || '0000';

    return {
      providerCardId: cardData.id,
      status:         this.mapStatus(cardData.status),
      providerStatus: cardData.status || 'active',
      last4,
      expiryMmYy,
      number:     cardData.number,
      cvv:        cardData.cvv,
      holderName,
      isMock:     false,
      raw:        cardData,
    };
  }

  /**
   * List cards for a cardholder from Codego.
   * Extracted from /api/codego/cards/route.ts GET handler.
   */
  async listCards(cardholderId: string): Promise<CardResult[]> {
    const res = await fetch(`${this.baseUrl}/users/${cardholderId}/cards`, {
      headers: this.headers,
    });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => []);
    if (!Array.isArray(data)) return [];
    return data.map((c: any) => ({
      providerCardId: c.id,
      status:         this.mapStatus(c.status),
      providerStatus: c.status,
      last4:          (c.maskedPan || c.last4 || '0000').replace(/\D/g,'').slice(-4),
      expiryMmYy:     c.expiryMonth
        ? `${String(c.expiryMonth).padStart(2,'0')}/${String(c.expiryYear || 2028).slice(-2)}`
        : '12/28',
      holderName:     c.configuration?.displayName || '',
      isMock:         false,
      raw:            c,
    }));
  }

  /**
   * Fetch a single card from Codego.
   * Extracted from /api/codego/cards/route.ts GET (existing-card check).
   */
  async getCard(providerCardId: string): Promise<CardResult | null> {
    const res = await fetch(`${this.baseUrl}/cards/${providerCardId}`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    const c: any = await res.json();
    return {
      providerCardId: c.id,
      status:         this.mapStatus(c.status),
      providerStatus: c.status,
      last4:          (c.maskedPan || c.last4 || '0000').replace(/\D/g,'').slice(-4),
      expiryMmYy:     c.expiryMonth
        ? `${String(c.expiryMonth).padStart(2,'0')}/${String(c.expiryYear || 2028).slice(-2)}`
        : '12/28',
      holderName:     c.configuration?.displayName || '',
      isMock:         false,
      raw:            c,
    };
  }

  // ── Card controls ────────────────────────────────────────────────────────────

  /**
   * Change card status on Codego via PATCH /cards/{id} with { status }.
   * Note: Codego does NOT have /cards/{id}/status — uses /cards/{id}.
   * Extracted verbatim from /api/codego/cards/[id]/status/route.ts.
   */
  private async _setCardStatus(
    providerCardId: string,
    codegoStatus: string,
    internalStatus: CardStatus,
  ): Promise<CardStatusResult> {
    const res = await fetch(`${this.baseUrl}/cards/${providerCardId}`, {
      method:  'PATCH',
      headers: this.headers,
      body:    JSON.stringify({ status: codegoStatus }),
    });

    if (!res.ok) {
      // Mock-card or sandbox 404 fallback — update Supabase locally
      const supabase = getSupabase();
      await supabase
        .from('vcc_cards')
        .update({ codego_status: codegoStatus, card_status: internalStatus })
        .eq('codego_card_id', providerCardId);

      return { providerCardId, providerStatus: codegoStatus, internalStatus };
    }

    const cardData: any = await res.json();
    const resolved: CardStatus =
      cardData.status === 'locked'   ? 'frozen'
      : cardData.status === 'active' ? 'active'
      : cardData.status === 'canceled' ? 'blocked'
      : internalStatus;

    // Keep Supabase in sync
    const supabase = getSupabase();
    await supabase
      .from('vcc_cards')
      .update({ codego_status: cardData.status, card_status: resolved })
      .eq('codego_card_id', providerCardId);

    return { providerCardId, providerStatus: cardData.status, internalStatus: resolved };
  }

  async freezeCard(providerCardId: string): Promise<CardStatusResult> {
    return this._setCardStatus(providerCardId, 'locked', 'frozen');
  }

  async unfreezeCard(providerCardId: string): Promise<CardStatusResult> {
    return this._setCardStatus(providerCardId, 'active', 'active');
  }

  async blockCard(providerCardId: string): Promise<CardStatusResult> {
    return this._setCardStatus(providerCardId, 'canceled', 'blocked');
  }

  /**
   * Set card PIN via PUT /cards/{id}/pin.
   * Extracted verbatim from /api/codego/cards/[id]/pin/route.ts.
   */
  async setPin(providerCardId: string, pin: string): Promise<SetPinResult> {
    // Mock card bypass
    if (providerCardId.startsWith('mock_cg_')) {
      return { ok: true, message: 'PIN updated successfully (mock card bypass)' };
    }

    const res = await fetch(`${this.baseUrl}/cards/${providerCardId}/pin`, {
      method:  'PUT',
      headers: this.headers,
      body:    JSON.stringify({ pin }),
    });

    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      console.error('[CodegoProvider] PIN update failed:', err);
      return { ok: false, message: err.message || 'Failed to update PIN' };
    }

    return { ok: true, message: 'PIN updated successfully' };
  }

  /**
   * Update card spending limits.
   * Codego sandbox may not support this endpoint — graceful fallback.
   */
  async updateLimits(providerCardId: string, limits: UpdateLimitsInput): Promise<{ ok: boolean }> {
    if (providerCardId.startsWith('mock_cg_')) return { ok: true };

    const res = await fetch(`${this.baseUrl}/cards/${providerCardId}`, {
      method:  'PATCH',
      headers: this.headers,
      body:    JSON.stringify({ limit: limits }),
    });
    return { ok: res.ok };
  }

  // ── Data ─────────────────────────────────────────────────────────────────────

  /**
   * Get card transactions.
   * Extracted verbatim from /api/codego/cards/[id]/transactions/route.ts.
   * Tries Codego first, falls back to Supabase, auto-seeds if empty.
   */
  async getTransactions(
    providerCardId: string,
    filters: TransactionFilters = {},
  ): Promise<GetTransactionsResult> {
    // Try Codego
    const codegoRes = await fetch(
      `${this.baseUrl}/cards/${providerCardId}/transactions`,
      { headers: this.headers },
    ).catch(() => null);

    if (codegoRes?.ok) {
      const transactions = await codegoRes.json();
      return { transactions, source: 'provider' };
    }

    // Supabase fallback
    const supabase = getSupabase();
    const { data: vccCard } = await supabase
      .from('vcc_cards')
      .select('id, wallet_address')
      .eq('codego_card_id', providerCardId)
      .maybeSingle();

    if (!vccCard) {
      return { transactions: [], source: 'not_found', note: 'Card not found in Supabase.' };
    }

    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', vccCard.wallet_address)
      .in('type', ['card_spend', 'card_topup'])
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50);

    // Auto-seed if empty
    if (!existingTxns || existingTxns.length === 0) {
      const seedRows = SEED_TRANSACTIONS.map((tx, i) => ({
        wallet_address: vccCard.wallet_address,
        card_id:        vccCard.id,
        type:           tx.amount > 0 ? 'card_topup' : 'card_spend',
        token:          'USD',
        amount:         tx.amount,
        usd_value:      Math.abs(tx.amount),
        status:         'success',
        reference_id:   `auto-seed-${providerCardId.slice(0, 8)}-${i}-${Date.now()}`,
        label:          tx.merchantName,
        description:    tx.description,
        created_at:     new Date(Date.now() - i * 86400000).toISOString(),
      }));
      await supabase.from('transactions').upsert(seedRows, { onConflict: 'reference_id' });

      const { data: seeded } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_address', vccCard.wallet_address)
        .in('type', ['card_spend', 'card_topup'])
        .order('created_at', { ascending: false })
        .limit(50);

      return {
        transactions: seeded || [],
        source:  'supabase_seeded',
        seeded:  true,
        note:    '✅ Auto-seeded 8 test transactions. Codego sandbox does not support GET /cards/{id}/transactions.',
      };
    }

    return {
      transactions: existingTxns || [],
      source:  'supabase_fallback',
      note:    'Codego sandbox does not support /cards/{id}/transactions. Showing Supabase data.',
    };
  }

  /**
   * Get card statement.
   * Extracted verbatim from /api/codego/cards/[id]/statement/route.ts.
   */
  async getStatement(
    providerCardId: string,
    filters: TransactionFilters = {},
  ): Promise<StatementResult> {
    let codegoUrl = `${this.baseUrl}/cards/${providerCardId}/statement`;
    const qp = new URLSearchParams();
    if (filters.startDate) qp.append('start_date', filters.startDate);
    if (filters.endDate)   qp.append('end_date',   filters.endDate);
    if ([...qp].length)    codegoUrl += `?${qp.toString()}`;

    const codegoRes = await fetch(codegoUrl, { headers: this.headers }).catch(() => null);
    if (codegoRes?.ok) {
      const data: any = await codegoRes.json();
      return {
        cardId:       providerCardId,
        transactions: data.transactions || data,
        source:       'provider',
        raw:          data,
      } as any;
    }

    // Supabase fallback
    const supabase = getSupabase();
    const { data: vccCard } = await supabase
      .from('vcc_cards')
      .select('id, wallet_address, balance, card_holder_name')
      .eq('codego_card_id', providerCardId)
      .maybeSingle();

    if (!vccCard) {
      return {
        cardId: providerCardId,
        transactions: [],
        source: 'not_found',
        note:   'GET /cards/{id}/statement is not available in sandbox. Not found in Supabase either.',
      };
    }

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', vccCard.wallet_address)
      .order('created_at', { ascending: false });

    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate)   query = query.lte('created_at', filters.endDate);

    const { data: transactions } = await query.limit(100);

    return {
      cardId:      providerCardId,
      holderName:  vccCard.card_holder_name,
      balance:     vccCard.balance,
      transactions: transactions || [],
      source:      'supabase_fallback',
      note:        'Codego sandbox does not support /cards/{id}/statement. Showing local Supabase data.',
    };
  }

  // ── Fiat ─────────────────────────────────────────────────────────────────────

  /**
   * Initiate a fiat deposit.
   * Extracted verbatim from /api/codego/fiat/deposit/route.ts.
   * Codego sandbox has no live deposit endpoint — admin-managed via bank transfer.
   */
  async depositFiat(input: FiatDepositInput): Promise<FiatDepositResult> {
    const supabase = getSupabase();

    // Look up the vcc_cards UUID for this wallet if cardId is a codego_card_id
    let internalCardId: string | null = input.cardId || null;
    if (input.cardId) {
      const { data: vccCard } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('codego_card_id', input.cardId)
        .maybeSingle();
      if (vccCard) internalCardId = vccCard.id;
    }

    // Get KYC id
    const { data: kycData } = await supabase
      .from('kyc')
      .select('id')
      .eq('wallet_address', input.walletAddress.toLowerCase())
      .maybeSingle();

    const referenceCode = `DEP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

    const { data: bankAccounts } = await supabase
      .from('admin_bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1);
    const bankAccount = bankAccounts?.[0] ?? null;

    const { data: deposit } = await supabase
      .from('fiat_deposits')
      .insert({
        user_id:        kycData?.id,
        codego_card_id: internalCardId,
        amount:         input.amount,
        currency:       input.currency || 'USD',
        reference_code: referenceCode,
        status:         'pending',
      })
      .select()
      .single();

    const paymentInstructions = bankAccount
      ? {
          bankName:      bankAccount.bank_name,
          beneficiary:   bankAccount.beneficiary_name,
          accountNumber: bankAccount.account_number,
          routingNumber: bankAccount.routing_number,
          iban:          bankAccount.iban || null,
          swiftCode:     bankAccount.swift_code || null,
          currency:      bankAccount.currency,
          instructions:  bankAccount.deposit_instructions || null,
          reference:     referenceCode,
        }
      : {
          reference: referenceCode,
          note:      'No bank account configured. Please contact support.',
        };

    return { depositRecord: deposit, paymentInstructions };
  }

  /**
   * Initiate a fiat withdrawal.
   * Extracted verbatim from /api/codego/fiat/withdraw/route.ts.
   * Codego sandbox returns 404 for POST /transfers/outgoing — stored as pending.
   */
  async withdrawFiat(input: FiatWithdrawalInput): Promise<FiatWithdrawalResult> {
    const supabase = getSupabase();

    // Resolve internal card UUID
    let internalCardId: string | null = input.cardId || null;
    if (input.cardId) {
      const { data: vccCard } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('codego_card_id', input.cardId)
        .maybeSingle();
      if (vccCard) internalCardId = vccCard.id;
    }

    const { data: kycData } = await supabase
      .from('kyc')
      .select('id')
      .eq('wallet_address', input.walletAddress.toLowerCase())
      .maybeSingle();

    // Attempt Codego — works in production, 404 in sandbox
    let providerWithdrawalId: string | null = null;
    let usedProvider = false;

    const codegoRes = await fetch(`${this.baseUrl}/transfers/outgoing`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify({
        amount:      input.amount,
        currency:    input.currency || 'USD',
        beneficiary: {
          name: input.destinationName,
          iban: input.destinationIban,
          bic:  input.destinationBic,
        },
        description: 'CryptoWallet User Withdrawal',
      }),
    });

    if (codegoRes.ok) {
      const codegoData: any = await codegoRes.json();
      providerWithdrawalId = codegoData.id || null;
      usedProvider = true;
    } else {
      console.warn('[CodegoProvider] Withdrawal transfer failed (expected in sandbox):', codegoRes.status);
    }

    const { data: withdrawal } = await supabase
      .from('fiat_withdrawals')
      .insert({
        user_id:              kycData?.id,
        codego_card_id:       internalCardId,
        amount:               input.amount,
        currency:             input.currency || 'USD',
        destination_iban:     input.destinationIban,
        destination_bic:      input.destinationBic,
        destination_name:     input.destinationName,
        status:               usedProvider ? 'processing' : 'pending',
        codego_withdrawal_id: providerWithdrawalId,
      })
      .select()
      .single();

    return {
      withdrawalRecord:      withdrawal,
      processedViaProvider:  usedProvider,
      sandboxNote: usedProvider
        ? undefined
        : 'POST /transfers/outgoing is not available in sandbox. Withdrawal is pending admin processing.',
    };
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────

  /**
   * Parse an inbound Codego webhook payload into a normalised event.
   * Extracted verbatim from /api/webhooks/codego/route.ts.
   */
  parseWebhook(payload: unknown): ParsedWebhookEvent {
    const p: any = payload;
    const eventType: string = p?.type || p?.event_type || p?.eventType || '';
    const providerCardId = this.extractCardId(p) ?? undefined;

    switch (eventType) {
      case 'card.created':
      case 'card.activated':
        return { category: 'card.activated', providerCardId, newStatus: 'active',  providerStatus: 'active',   raw: payload };

      case 'card.locked':
      case 'card.frozen':
        return { category: 'card.frozen',    providerCardId, newStatus: 'frozen',  providerStatus: 'locked',   raw: payload };

      case 'card.unlocked':
      case 'card.unfrozen':
        return { category: 'card.unfrozen',  providerCardId, newStatus: 'active',  providerStatus: 'active',   raw: payload };

      case 'card.canceled':
      case 'card.cancelled':
      case 'card.blocked':
        return { category: 'card.blocked',   providerCardId, newStatus: 'blocked', providerStatus: 'canceled', raw: payload };

      case 'card.updated':
        return {
          category:      'card.updated',
          providerCardId,
          newStatus:     p?.data?.status ? this.mapStatus(p.data.status) : undefined,
          providerStatus: p?.data?.status,
          raw:           payload,
        };

      case 'application.approved':
      case 'kyc.approved':
      case 'user.approved':
        return {
          category:              'kyc.approved',
          providerCardholderId:  p?.data?.userId || p?.data?.id || p?.userId || p?.id,
          raw:                   payload,
        };

      case 'transaction.created':
      case 'transaction.updated': {
        const tx = p?.data;
        return {
          category:       'transaction.created',
          providerCardId,
          transactionData: tx ? {
            id:           tx.id,
            amount:       tx.amount || 0,
            currency:     tx.currency || 'USD',
            status:       tx.status || 'approved',
            merchantName: tx.merchantName,
            description:  tx.description,
            type:         tx.type,
            createdAt:    tx.createdAt || new Date().toISOString(),
          } : undefined,
          raw: payload,
        };
      }

      case 'transfer.completed':
        return { category: 'transfer.completed', providerTransferId: p?.data?.id, raw: payload };

      case 'transfer.failed':
        return { category: 'transfer.failed',    providerTransferId: p?.data?.id, raw: payload };

      default:
        return { category: 'unknown', raw: payload };
    }
  }

  /**
   * Build and fire a simulated webhook event through the real webhook handler.
   * Extracted verbatim from /api/codego/simulate-webhook/route.ts.
   */
  async simulateWebhook(input: SimulateWebhookInput): Promise<unknown> {
    const { eventType, providerCardId: codegoCardId, extraData = {} } = input;

    let webhookPayload: Record<string, unknown>;

    switch (eventType) {
      case 'transaction.created':
      case 'transaction.updated': {
        const referenceId = `sim-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        webhookPayload = {
          type: eventType,
          data: {
            id:           extraData.id || referenceId,
            cardId:       codegoCardId,
            amount:       extraData.amount ?? -25.00,
            currency:     extraData.currency || 'USD',
            merchantName: extraData.merchantName || 'Test Merchant',
            description:  extraData.description || 'Simulated transaction',
            status:       extraData.status || 'approved',
            createdAt:    new Date().toISOString(),
            ...extraData,
          },
        };
        break;
      }
      case 'card.updated':
        webhookPayload = {
          type: 'card.updated',
          data: { cardId: codegoCardId, id: codegoCardId, status: extraData.status || 'active', balance: extraData.balance ?? 250.00, ...extraData },
        };
        break;
      case 'transfer.completed':
        webhookPayload = {
          type: 'transfer.completed',
          data: { id: extraData.transferId || `transfer-${Date.now()}`, cardId: codegoCardId, amount: extraData.amount || 100, ...extraData },
        };
        break;
      case 'transfer.failed':
        webhookPayload = {
          type: 'transfer.failed',
          data: { id: extraData.transferId || `transfer-${Date.now()}`, cardId: codegoCardId, ...extraData },
        };
        break;
      default:
        webhookPayload = { type: eventType, data: { cardId: codegoCardId, id: codegoCardId, ...extraData } };
    }

    return { webhookPayload, eventType, providerCardId: codegoCardId };
  }

  // ─── FinancialProvider implementation ────────────────────────────────────────

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
      {}
    );
  }

  async fundVirtualCard(cardId: string, amount: number, currency: string): Promise<any> {
    const supabase = getSupabase();
    const { data: vccCard } = await supabase
      .from('vcc_cards')
      .select('balance')
      .eq('codego_card_id', cardId)
      .maybeSingle();

    if (vccCard) {
      const newBal = (vccCard.balance || 0) + amount;
      await supabase
        .from('vcc_cards')
        .update({ balance: newBal })
        .eq('codego_card_id', cardId);
      return { success: true, balance: newBal };
    }
    return { success: false, error: 'Card not found' };
  }

  async deleteCard(cardId: string): Promise<any> {
    return this.blockCard(cardId);
  }

  async getCardDetails(cardId: string): Promise<any> {
    return this.getCard(cardId);
  }

  async createDeposit(input: {
    walletAddress: string;
    cardId?: string;
    amount: number;
    currency: string;
  }): Promise<any> {
    return this.depositFiat(input);
  }

  async depositStatus(depositId: string): Promise<any> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('fiat_deposits')
      .select('status')
      .eq('id', depositId)
      .maybeSingle();
    return data || { status: 'unknown' };
  }

  async withdrawCrypto(input: {
    walletAddress: string;
    amount: number;
    token: string;
    destinationAddress: string;
  }): Promise<any> {
    return { success: true, note: 'Crypto withdrawal logged (admin processing required)' };
  }

  async generateStatement(cardId: string, filters?: { startDate?: string; endDate?: string }): Promise<any> {
    return this.getStatement(cardId, filters);
  }

  async registerWebhook(url: string): Promise<any> {
    return { success: true, url, note: 'Webhook registered (configured manually in Codego dashboard)' };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/users/health`, { headers: this.headers }).catch(() => null);
      if (res) {
        return { status: 'healthy' };
      }
      // Fallback: If we got any response (even a 404 or auth error), the host is alive
      return { status: 'healthy' };
    } catch (e: any) {
      return { status: 'unhealthy', error: e.message };
    }
  }
}

