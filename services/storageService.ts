import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const KEYS = {
  PRIVATE_KEY:    'wallet_private_key',
  MNEMONIC:       'wallet_mnemonic',
  WALLET_ADDRESS: 'wallet_address',
  TRON_ADDRESS:   'wallet_tron_address',
  TRON_PRIV_KEY:  'wallet_tron_private_key',
  WALLET_NAME:    'wallet_name',
  VERIFIED_EMAIL: 'cw_verified_email',
};

// Web fallback logic
const WEB_SALT = process.env.EXPO_PUBLIC_WEB_SALT || 'cw_w3b_s4lt_2024';

function xorEncode(str: string, key: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function xorDecode(encoded: string, key: string): string {
  try {
    const str = atob(encoded);
    let result = '';
    for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return encoded;
  }
}

export const storageService = {
  /**
   * Saves critical wallet data. 
   * Private keys and mnemonics go to SecureStore (encrypted at OS level).
   * Public address goes to AsyncStorage for fast retrieval.
   */
  async saveWallet(privateKey: string, mnemonic: string, address: string, tronAddress?: string, tronPrivateKey?: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(KEYS.PRIVATE_KEY,    xorEncode(privateKey, WEB_SALT));
      localStorage.setItem(KEYS.MNEMONIC,       xorEncode(mnemonic,   WEB_SALT));
      localStorage.setItem(KEYS.WALLET_ADDRESS, address);
      if (tronAddress)    localStorage.setItem(KEYS.TRON_ADDRESS,  tronAddress);
      if (tronPrivateKey) localStorage.setItem(KEYS.TRON_PRIV_KEY, xorEncode(tronPrivateKey, WEB_SALT));
    } else {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.PRIVATE_KEY, privateKey),
        SecureStore.setItemAsync(KEYS.MNEMONIC,    mnemonic),
        AsyncStorage.setItem(KEYS.WALLET_ADDRESS,  address),
        tronAddress    ? AsyncStorage.setItem(KEYS.TRON_ADDRESS, tronAddress)                    : Promise.resolve(),
        tronPrivateKey ? SecureStore.setItemAsync(KEYS.TRON_PRIV_KEY, tronPrivateKey)            : Promise.resolve(),
      ]);
    }
  },

  async getPrivateKey(): Promise<string | null> {
    if (Platform.OS === 'web') {
      const val = localStorage.getItem(KEYS.PRIVATE_KEY);
      return val ? xorDecode(val, WEB_SALT) : null;
    }
    return await SecureStore.getItemAsync(KEYS.PRIVATE_KEY);
  },

  async getMnemonic(): Promise<string | null> {
    if (Platform.OS === 'web') {
      const val = localStorage.getItem(KEYS.MNEMONIC);
      return val ? xorDecode(val, WEB_SALT) : null;
    }
    return await SecureStore.getItemAsync(KEYS.MNEMONIC);
  },

  async getTronPrivateKey(): Promise<string | null> {
    if (Platform.OS === 'web') {
      const val = localStorage.getItem(KEYS.TRON_PRIV_KEY);
      return val ? xorDecode(val, WEB_SALT) : null;
    }
    return await SecureStore.getItemAsync(KEYS.TRON_PRIV_KEY);
  },

  async getTronAddress(): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(KEYS.TRON_ADDRESS);
    return await AsyncStorage.getItem(KEYS.TRON_ADDRESS);
  },

  async saveTronAddress(address: string): Promise<void> {
    if (Platform.OS === 'web') localStorage.setItem(KEYS.TRON_ADDRESS, address);
    else await AsyncStorage.setItem(KEYS.TRON_ADDRESS, address);
  },

  async getWalletAddress(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(KEYS.WALLET_ADDRESS);
    }
    return await AsyncStorage.getItem(KEYS.WALLET_ADDRESS);
  },

  async saveWalletName(name: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(KEYS.WALLET_NAME, name);
    } else {
      await AsyncStorage.setItem(KEYS.WALLET_NAME, name);
    }
  },

  async getWalletName(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(KEYS.WALLET_NAME);
    }
    return await AsyncStorage.getItem(KEYS.WALLET_NAME);
  },

  async hasWallet(): Promise<boolean> {
    const address = await this.getWalletAddress();
    return !!address;
  },

  async saveCardDetails(details: any): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem('cw_card_details', xorEncode(JSON.stringify(details), WEB_SALT));
    } else {
      await SecureStore.setItemAsync('cw_card_details', JSON.stringify(details));
    }
  },

  async getCardDetails(): Promise<any | null> {
    if (Platform.OS === 'web') {
      const val = localStorage.getItem('cw_card_details');
      if (!val) return null;
      try { return JSON.parse(xorDecode(val, WEB_SALT)); } catch { return null; }
    }
    const val = await SecureStore.getItemAsync('cw_card_details');
    return val ? JSON.parse(val) : null;
  },

  async clearCardDetails(): Promise<void> {
    if (Platform.OS === 'web') localStorage.removeItem('cw_card_details');
    else await SecureStore.deleteItemAsync('cw_card_details');
  },

  async getVerifiedEmail(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        const local = localStorage.getItem(KEYS.VERIFIED_EMAIL) || localStorage.getItem('cw_user_email') || localStorage.getItem('cw_email');
        if (local) return local.trim().toLowerCase();
        if (localStorage.getItem('cw_device_verified') === 'true' || localStorage.getItem('cw_has_ever_verified') === 'true') {
          return 'verified_user@device';
        }
      } else {
        const as = await AsyncStorage.getItem(KEYS.VERIFIED_EMAIL) || await AsyncStorage.getItem('cw_user_email') || await AsyncStorage.getItem('cw_email');
        if (as) return as.trim().toLowerCase();
        if ((await AsyncStorage.getItem('cw_device_verified')) === 'true' || (await AsyncStorage.getItem('cw_has_ever_verified')) === 'true') {
          return 'verified_user@device';
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        const email = userData.user.email.trim().toLowerCase();
        await this.setVerifiedEmail(email);
        return email;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.email) {
        const email = sessionData.session.user.email.trim().toLowerCase();
        await this.setVerifiedEmail(email);
        return email;
      }
    } catch (_e) {}
    return null;
  },

  async setVerifiedEmail(email: string): Promise<void> {
    const clean = email.trim().toLowerCase();
    if (Platform.OS === 'web') {
      localStorage.setItem(KEYS.VERIFIED_EMAIL, clean);
      localStorage.setItem('cw_device_verified', 'true');
      localStorage.setItem('cw_has_ever_verified', 'true');
    } else {
      await AsyncStorage.setItem(KEYS.VERIFIED_EMAIL, clean);
      await AsyncStorage.setItem('cw_device_verified', 'true');
      await AsyncStorage.setItem('cw_has_ever_verified', 'true');
    }
  },

  async clearWallet(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(KEYS.PRIVATE_KEY);
      localStorage.removeItem(KEYS.MNEMONIC);
      localStorage.removeItem(KEYS.WALLET_ADDRESS);
      localStorage.removeItem(KEYS.WALLET_NAME);
      localStorage.removeItem(KEYS.TRON_ADDRESS);      // ← fix: clear TRON address too
      localStorage.removeItem(KEYS.TRON_PRIV_KEY);
      this.clearCardDetails();
    } else {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.PRIVATE_KEY),
        SecureStore.deleteItemAsync(KEYS.MNEMONIC),
        AsyncStorage.removeItem(KEYS.WALLET_ADDRESS),
        AsyncStorage.removeItem(KEYS.WALLET_NAME),
        AsyncStorage.removeItem(KEYS.TRON_ADDRESS),    // ← fix: clear TRON address too
        this.clearCardDetails(),
      ]);
    }
  },

  async clearKeysOnly(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(KEYS.PRIVATE_KEY);
      localStorage.removeItem(KEYS.MNEMONIC);
      localStorage.removeItem(KEYS.WALLET_ADDRESS);
      localStorage.removeItem(KEYS.TRON_ADDRESS);      // ← fix
      localStorage.removeItem(KEYS.TRON_PRIV_KEY);
      this.clearCardDetails();
    } else {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.PRIVATE_KEY),
        SecureStore.deleteItemAsync(KEYS.MNEMONIC),
        AsyncStorage.removeItem(KEYS.WALLET_ADDRESS),
        AsyncStorage.removeItem(KEYS.TRON_ADDRESS),    // ← fix
        this.clearCardDetails(),
      ]);
    }
  },

  async clearSecretsOnly(): Promise<void> {
    // Removes ONLY private key + mnemonic — keeps wallet address.
    // Used for "Delete Account" read-only mode so balance is still visible.
    if (Platform.OS === 'web') {
      localStorage.removeItem(KEYS.PRIVATE_KEY);
      localStorage.removeItem(KEYS.MNEMONIC);
      localStorage.removeItem(KEYS.TRON_PRIV_KEY);    // ← fix: clear TRON private key too
    } else {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.PRIVATE_KEY),
        SecureStore.deleteItemAsync(KEYS.MNEMONIC),
      ]);
    }
  },
};
