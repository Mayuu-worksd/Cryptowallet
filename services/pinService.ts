import { Platform } from 'react-native';

const PIN_KEY = 'cw_pin_hash';

// SHA-256 hash via Web Crypto API (available on both web and React Native via Hermes)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(pin);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStorage() {
  if (Platform.OS === 'web') {
    return {
      getItem:    async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
      removeItem: async (k: string) => { try { localStorage.removeItem(k); } catch {} },
    };
  }
  return require('@react-native-async-storage/async-storage').default;
}

export async function hasPinSetup(): Promise<boolean> {
  const pin = await getStorage().getItem(PIN_KEY);
  return !!pin;
}

export async function clearPin(): Promise<void> {
  await getStorage().removeItem(PIN_KEY);
}

export async function savePin(pin: string): Promise<void> {
  const hashed = await hashPin(pin);
  await getStorage().setItem(PIN_KEY, hashed);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getStorage().getItem(PIN_KEY);
  if (!stored) return true; // no PIN set, allow through
  const hashed = await hashPin(pin);
  return hashed === stored;
}
