import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  PRIVATE_KEY:    'wallet_private_key',
  MNEMONIC:       'wallet_mnemonic',
  WALLET_ADDRESS: 'wallet_address',
  WALLET_NAME:    'wallet_name',
};

// Simple obfuscation for web localStorage — not cryptographic but prevents
// plain-text private key sitting in localStorage readable by JS.
// On mobile, expo-secure-store handles real encryption at OS level.
// EXPO_PUBLIC_WEB_SALT must be set in your .env file — never hardcode a fallback.
const WEB_SALT = process.env.EXPO_PUBLIC_WEB_SALT;
if (!WEB_SALT && Platform.OS === 'web') {
  console.warn('EXPO_PUBLIC_WEB_SALT is not set. Web storage obfuscation is disabled.');
}

function xorEncode(str: string, key: string | undefined): string {
  if (!key) return btoa(str);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function xorDecode(encoded: string, key: string | undefined): string {
  try {
    const str = atob(encoded);
    if (!key) return str;
    let result = '';
    for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return encoded;
  }
}

const storage = {
  async set(key: string, value: string, sensitive = false): Promise<void> {
    if (Platform.OS === 'web') {
      const stored = sensitive ? xorEncode(value, WEB_SALT) : value;
      localStorage.setItem(key, stored);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async get(key: string, sensitive = false): Promise<string | null> {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return sensitive ? xorDecode(raw, WEB_SALT) : raw;
    }
    return await SecureStore.getItemAsync(key);
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const storageService = {
  async saveWallet(privateKey: string, mnemonic: string, address: string): Promise<void> {
    await storage.set(KEYS.PRIVATE_KEY,    privateKey, true);
    await storage.set(KEYS.MNEMONIC,       mnemonic,   true);
    await storage.set(KEYS.WALLET_ADDRESS, address,    false);
  },

  async getPrivateKey(): Promise<string | null> {
    return await storage.get(KEYS.PRIVATE_KEY, true);
  },

  async getMnemonic(): Promise<string | null> {
    return await storage.get(KEYS.MNEMONIC, true);
  },

  async getWalletAddress(): Promise<string | null> {
    return await storage.get(KEYS.WALLET_ADDRESS, false);
  },

  async hasWallet(): Promise<boolean> {
    const address = await storage.get(KEYS.WALLET_ADDRESS, false);
    return !!address;
  },

  async saveWalletAddress(address: string): Promise<void> {
    await storage.set(KEYS.WALLET_ADDRESS, address, false);
  },

  async saveWalletName(name: string): Promise<void> {
    await storage.set(KEYS.WALLET_NAME, name, false);
  },

  async getWalletName(): Promise<string | null> {
    return await storage.get(KEYS.WALLET_NAME, false);
  },

  async clearWallet(): Promise<void> {
    await storage.delete(KEYS.PRIVATE_KEY);
    await storage.delete(KEYS.MNEMONIC);
    await storage.delete(KEYS.WALLET_ADDRESS);
    await storage.delete(KEYS.WALLET_NAME);
  },
};
