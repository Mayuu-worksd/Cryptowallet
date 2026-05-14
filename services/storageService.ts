import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  PRIVATE_KEY:    'wallet_private_key',
  MNEMONIC:       'wallet_mnemonic',
  WALLET_ADDRESS: 'wallet_address',
  TRON_ADDRESS:   'wallet_tron_address',
  TRON_PRIV_KEY:  'wallet_tron_private_key',
  WALLET_NAME:    'wallet_name',
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
  async saveWallet(privateKey: string, mnemonic: string, address: string, tronAddress?: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(KEYS.PRIVATE_KEY,    xorEncode(privateKey, WEB_SALT));
      localStorage.setItem(KEYS.MNEMONIC,       xorEncode(mnemonic,   WEB_SALT));
      localStorage.setItem(KEYS.WALLET_ADDRESS, address);
      if (tronAddress) localStorage.setItem(KEYS.TRON_ADDRESS, tronAddress);
    } else {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.PRIVATE_KEY, privateKey),
        SecureStore.setItemAsync(KEYS.MNEMONIC,    mnemonic),
        AsyncStorage.setItem(KEYS.WALLET_ADDRESS,  address),
        tronAddress ? AsyncStorage.setItem(KEYS.TRON_ADDRESS, tronAddress) : Promise.resolve(),
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

  async clearWallet(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(KEYS.PRIVATE_KEY);
      localStorage.removeItem(KEYS.MNEMONIC);
      localStorage.removeItem(KEYS.WALLET_ADDRESS);
      localStorage.removeItem(KEYS.WALLET_NAME);
      localStorage.removeItem(KEYS.TRON_ADDRESS);      // ← fix: clear TRON address too
      localStorage.removeItem(KEYS.TRON_PRIV_KEY);
    } else {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.PRIVATE_KEY),
        SecureStore.deleteItemAsync(KEYS.MNEMONIC),
        AsyncStorage.removeItem(KEYS.WALLET_ADDRESS),
        AsyncStorage.removeItem(KEYS.WALLET_NAME),
        AsyncStorage.removeItem(KEYS.TRON_ADDRESS),    // ← fix: clear TRON address too
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
    } else {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.PRIVATE_KEY),
        SecureStore.deleteItemAsync(KEYS.MNEMONIC),
        AsyncStorage.removeItem(KEYS.WALLET_ADDRESS),
        AsyncStorage.removeItem(KEYS.TRON_ADDRESS),    // ← fix
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
