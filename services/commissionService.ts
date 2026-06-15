import { adminSettingsService } from './supabaseService';

export type FeeConfig = {
  type: 'percentage' | 'fixed';
  value: number;
};

export type CommissionRates = {
  card_fee: FeeConfig;
  swap_fee: FeeConfig;
  p2p_fee: FeeConfig;
  send_fee: FeeConfig;
  receive_fee: FeeConfig;
  settlement_fee: FeeConfig;
};

const DEFAULT_COMMISSION_RATES: CommissionRates = {
  card_fee: { type: 'percentage', value: 0 },
  swap_fee: { type: 'percentage', value: 0 },
  p2p_fee: { type: 'fixed', value: 0 },
  send_fee: { type: 'fixed', value: 0 },
  receive_fee: { type: 'fixed', value: 0 },
  settlement_fee: { type: 'percentage', value: 0 }
};

class CommissionService {
  private rates: CommissionRates = DEFAULT_COMMISSION_RATES;

  async loadRates() {
    this.rates = await adminSettingsService.getSetting<CommissionRates>('commission_rates', DEFAULT_COMMISSION_RATES);
  }

  getRates(): CommissionRates {
    return this.rates;
  }

  calculateFee(feeType: keyof CommissionRates, amountUSD: number): number {
    const config = this.rates[feeType];
    if (!config) return 0;
    
    if (config.type === 'percentage') {
      return (amountUSD * config.value) / 100;
    } else {
      return config.value;
    }
  }
}

export const commissionService = new CommissionService();
