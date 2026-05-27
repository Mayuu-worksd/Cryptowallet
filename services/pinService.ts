import { Platform } from 'react-native';
import AsyncStorageNative from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ── Key names ──────────────────────────────────────────────────────────────────
// PIN hash + salt → SecureStore (encrypted OS keychain/keystore)
const PIN_KEY      = 'cw_pin_hash';
const PIN_SALT_KEY = 'cw_pin_salt';

// Lockout counters → AsyncStorage (non-sensitive, survives app reinstall on Android)
const LOCKOUT_KEY  = 'cw_pin_lockout';
const ATTEMPTS_KEY = 'cw_pin_attempts';

const MAX_ATTEMPTS  = 5;
const LOCKOUT_TIERS = [30_000, 60_000, 300_000]; // 30s, 1min, 5min

// ── Secure storage abstraction ─────────────────────────────────────────────────
// PIN hash + salt use SecureStore on native, localStorage on web.
const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch (_e) {}
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch (_e) {}
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// ── Non-sensitive storage (lockout counters) ───────────────────────────────────
const plainStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return AsyncStorageNative.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch (_e) {}
      return;
    }
    return AsyncStorageNative.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch (_e) {}
      return;
    }
    return AsyncStorageNative.removeItem(key);
  },
};

// ── Per-device random salt ─────────────────────────────────────────────────────
async function getOrCreateSalt(): Promise<string> {
  const existing = await secureStorage.getItem(PIN_SALT_KEY);
  if (existing) return existing;

  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Secure random number generation is not available on this device.');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt  = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  await secureStorage.setItem(PIN_SALT_KEY, salt);
  return salt;
}

// ── SHA-256 hash (no fallback — if crypto.subtle is unavailable, PIN cannot be saved) ──
async function hashPin(pin: string, salt: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Cryptographic hashing is not available on this device. Cannot save PIN.');
  }
  const encoder = new TextEncoder();
  const data    = encoder.encode(pin + salt);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Lockout state ──────────────────────────────────────────────────────────────
export type LockoutState = {
  isLocked: boolean;
  remainingMs: number;
  attemptsLeft: number;
};

export async function getLockoutState(): Promise<LockoutState> {
  try {
    const [lockoutStr, attemptsStr] = await Promise.all([
      plainStorage.getItem(LOCKOUT_KEY),
      plainStorage.getItem(ATTEMPTS_KEY),
    ]);

    const attempts     = parseInt(attemptsStr ?? '0', 10);
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);

    if (!lockoutStr) return { isLocked: false, remainingMs: 0, attemptsLeft };

    const { until } = JSON.parse(lockoutStr);
    const remaining  = until - Date.now();

    if (remaining <= 0) {
      await plainStorage.removeItem(LOCKOUT_KEY);
      return { isLocked: false, remainingMs: 0, attemptsLeft };
    }

    return { isLocked: true, remainingMs: remaining, attemptsLeft: 0 };
  } catch {
    return { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS };
  }
}

async function recordFailedAttempt(): Promise<LockoutState> {
  const attemptsStr = await plainStorage.getItem(ATTEMPTS_KEY);
  const attempts    = parseInt(attemptsStr ?? '0', 10) + 1;
  await plainStorage.setItem(ATTEMPTS_KEY, String(attempts));

  if (attempts >= MAX_ATTEMPTS) {
    const tier     = Math.min(Math.floor(attempts / MAX_ATTEMPTS) - 1, LOCKOUT_TIERS.length - 1);
    const duration = LOCKOUT_TIERS[tier];
    const until    = Date.now() + duration;
    await plainStorage.setItem(LOCKOUT_KEY, JSON.stringify({ until, tier }));
    return { isLocked: true, remainingMs: duration, attemptsLeft: 0 };
  }

  return { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS - attempts };
}

async function clearFailedAttempts(): Promise<void> {
  await Promise.all([
    plainStorage.removeItem(LOCKOUT_KEY),
    plainStorage.removeItem(ATTEMPTS_KEY),
  ]);
}

// ── Public API ─────────────────────────────────────────────────────────────────
export async function hasPinSetup(): Promise<boolean> {
  const val = await secureStorage.getItem(PIN_KEY);
  return !!val;
}

export async function savePin(pin: string): Promise<void> {
  const salt   = await getOrCreateSalt();
  const hashed = await hashPin(pin, salt);
  await secureStorage.setItem(PIN_KEY, hashed);
  await clearFailedAttempts();
}

export type VerifyResult = {
  success: boolean;
  lockout: LockoutState;
};

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const lockout = await getLockoutState();
  if (lockout.isLocked) return { success: false, lockout };

  const stored = await secureStorage.getItem(PIN_KEY);
  if (!stored) {
    return { success: true, lockout: { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS } };
  }

  const salt = await secureStorage.getItem(PIN_SALT_KEY);
  if (!salt) return { success: false, lockout: { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS } };

  const hashed = await hashPin(pin, salt);

  if (hashed === stored) {
    await clearFailedAttempts();
    return { success: true, lockout: { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS } };
  }

  const newLockout = await recordFailedAttempt();
  return { success: false, lockout: newLockout };
}

export async function clearPin(): Promise<void> {
  await Promise.all([
    secureStorage.removeItem(PIN_KEY),
    secureStorage.removeItem(PIN_SALT_KEY),
    plainStorage.removeItem(LOCKOUT_KEY),
    plainStorage.removeItem(ATTEMPTS_KEY),
  ]);
}
