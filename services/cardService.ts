/**
 * cardService.ts
 * Local card helpers — balance and freeze state via AsyncStorage.
 * Card number/CVV/expiry are generated randomly in vccService (supabaseService.ts)
 * and shown once on issuance. Never derived from wallet address.
 */
import { Platform } from 'react-native';

let AsyncStorage: any;
if (Platform.OS === 'web') {
  AsyncStorage = {
    getItem: async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} },
  };
} else {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

export type Merchant = {
  name: string;
  amount: number;
  icon: string;
};

/** Parse an ethereum: payment URI */
export function parsePaymentQR(data: string): { address: string; amountEth?: number; label?: string } | null {
  try {
    if (data.startsWith('ethereum:')) {
      const [addrPart, queryPart] = data.slice(9).split('?');
      const address = addrPart.split('@')[0];
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
      const params = new URLSearchParams(queryPart ?? '');
      const valueWei = params.get('value');
      const label    = params.get('label') ?? params.get('message') ?? undefined;
      const amountEth = valueWei ? parseFloat(valueWei) / 1e18 : undefined;
      return { address, amountEth, label };
    }
    if (/^0x[0-9a-fA-F]{40}$/.test(data.trim())) {
      return { address: data.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export const cardService = {
  getCardBalance: async (): Promise<number> => {
    try {
      const bal = await AsyncStorage.getItem('cw_card_balance');
      return bal ? parseFloat(bal) : 0;
    } catch {
      return 0;
    }
  },

  setCardBalance: async (balance: number) => {
    try {
      await AsyncStorage.setItem('cw_card_balance', String(balance));
    } catch (_e) {}
  },

  getCardFrozen: async (): Promise<boolean> => {
    try {
      const frozen = await AsyncStorage.getItem('card_frozen');
      return frozen === 'true';
    } catch {
      return false;
    }
  },

  setCardFrozen: async (frozen: boolean) => {
    try {
      await AsyncStorage.setItem('card_frozen', String(frozen));
    } catch (_e) {}
  },
};
