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

/** Parse an ethereum: payment URI — returns merchant name + USD amount if value present */
export function parsePaymentQR(data: string): { address: string; amountEth?: number; label?: string } | null {
  try {
    // ethereum:0xADDR?value=WEI&label=NAME
    if (data.startsWith('ethereum:')) {
      const [addrPart, queryPart] = data.slice(9).split('?');
      const address = addrPart.split('@')[0]; // strip chain id
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
      const params = new URLSearchParams(queryPart ?? '');
      const valueWei = params.get('value');
      const label    = params.get('label') ?? params.get('message') ?? undefined;
      const amountEth = valueWei ? parseFloat(valueWei) / 1e18 : undefined;
      return { address, amountEth, label };
    }
    // Plain address
    if (/^0x[0-9a-fA-F]{40}$/.test(data.trim())) {
      return { address: data.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a deterministic-but-unique card number from a wallet address.
 * Same address always produces the same card — but different addresses get different cards.
 * Format: XXXX XXXX XXXX XXXX (16 digits, Luhn-valid last digit)
 */
function generateCardNumber(walletAddress: string): string {
  // Use last 12 hex chars of address as seed
  const seed = walletAddress.replace('0x', '').slice(-12).toUpperCase();
  // Convert hex pairs to decimal digits (0-9) by taking mod 10
  const digits: number[] = [];
  for (let i = 0; i < 12; i += 2) {
    digits.push(parseInt(seed.slice(i, i + 2), 16) % 10);
  }
  // Pad to 15 digits with address-derived values
  while (digits.length < 15) {
    digits.push(parseInt(walletAddress.slice(digits.length + 2, digits.length + 4) || '42', 16) % 10);
  }
  // Luhn checksum for last digit
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = digits[i];
    if ((15 - i) % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  digits.push((10 - (sum % 10)) % 10);
  // Format as XXXX XXXX XXXX XXXX
  return [
    digits.slice(0, 4).join(''),
    digits.slice(4, 8).join(''),
    digits.slice(8, 12).join(''),
    digits.slice(12, 16).join(''),
  ].join(' ');
}

/**
 * Generates a deterministic expiry date from wallet address.
 * Always 3–5 years in the future from a fixed base, unique per address.
 */
function generateExpiry(walletAddress: string): string {
  const seed = parseInt(walletAddress.slice(-4), 16);
  const month = (seed % 12) + 1;
  const year  = 2027 + (seed % 4); // 2027–2030
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

/**
 * Generates a deterministic 3-digit CVV from wallet address.
 */
function generateCVV(walletAddress: string): string {
  const seed = parseInt(walletAddress.slice(-6), 16);
  return String(100 + (seed % 900)); // 100–999
}

export const cardService = {
  /**
   * Returns card details unique to this wallet address.
   * Card number, expiry, and CVV are derived from the address — not hardcoded.
   */
  getFixedCardDetails: (holderName: string, design: string, walletAddress?: string) => {
    const addr = walletAddress ?? '0x0000000000000000000000000000000000000000';
    return {
      number:     generateCardNumber(addr),
      expiry:     generateExpiry(addr),
      cvv:        generateCVV(addr),
      brand:      'VISA' as const,
      holderName: holderName.toUpperCase().trim() || 'CARD HOLDER',
      design,
    };
  },

  // Storage key aligned with WalletContext ('cw_card_balance')
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
