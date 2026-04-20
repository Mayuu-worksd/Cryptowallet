import { Platform } from 'react-native';

const PIN_KEY          = 'cw_pin_hash';
const PIN_SALT_KEY     = 'cw_pin_salt';
const LOCKOUT_KEY      = 'cw_pin_lockout';
const ATTEMPTS_KEY     = 'cw_pin_attempts';

const MAX_ATTEMPTS     = 5;
const LOCKOUT_DURATION = 30_000; // 30 seconds base
const LOCKOUT_TIERS    = [30_000, 60_000, 300_000]; // 30s, 1min, 5min per tier

// ── Storage abstraction ────────────────────────────────────────────────────────
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    const AS = require('@react-native-async-storage/async-storage').default;
    return AS.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    const AS = require('@react-native-async-storage/async-storage').default;
    return AS.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    const AS = require('@react-native-async-storage/async-storage').default;
    return AS.removeItem(key);
  },
};

// ── Per-device random salt ─────────────────────────────────────────────────────
// Generated once on first PIN setup, stored alongside the hash.
// Means even if two users have the same PIN, their hashes differ.
async function getOrCreateSalt(): Promise<string> {
  const existing = await storage.getItem(PIN_SALT_KEY);
  if (existing) return existing;

  // Generate 16 random bytes as hex
  let salt: string;
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: timestamp + Math.random
    salt = Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  await storage.setItem(PIN_SALT_KEY, salt);
  return salt;
}

// ── SHA-256 with per-device salt ───────────────────────────────────────────────
async function hashPin(pin: string, salt: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data    = encoder.encode(pin + salt);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback djb2 hash when crypto.subtle unavailable
    let hash = 5381;
    const salted = pin + salt;
    for (let i = 0; i < salted.length; i++) {
      hash = ((hash << 5) + hash) ^ salted.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
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
      storage.getItem(LOCKOUT_KEY),
      storage.getItem(ATTEMPTS_KEY),
    ]);

    const attempts = parseInt(attemptsStr ?? '0', 10);
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);

    if (!lockoutStr) return { isLocked: false, remainingMs: 0, attemptsLeft };

    const { until } = JSON.parse(lockoutStr);
    const remaining = until - Date.now();

    if (remaining <= 0) {
      // Lockout expired — clear it but keep attempt count for tier escalation
      await storage.removeItem(LOCKOUT_KEY);
      return { isLocked: false, remainingMs: 0, attemptsLeft };
    }

    return { isLocked: true, remainingMs: remaining, attemptsLeft: 0 };
  } catch {
    return { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS };
  }
}

async function recordFailedAttempt(): Promise<LockoutState> {
  const attemptsStr = await storage.getItem(ATTEMPTS_KEY);
  const attempts    = parseInt(attemptsStr ?? '0', 10) + 1;
  await storage.setItem(ATTEMPTS_KEY, String(attempts));

  if (attempts >= MAX_ATTEMPTS) {
    // Escalating lockout: 30s → 1min → 5min → 5min forever
    const tier      = Math.min(Math.floor(attempts / MAX_ATTEMPTS) - 1, LOCKOUT_TIERS.length - 1);
    const duration  = LOCKOUT_TIERS[tier];
    const until     = Date.now() + duration;
    await storage.setItem(LOCKOUT_KEY, JSON.stringify({ until, tier }));
    return { isLocked: true, remainingMs: duration, attemptsLeft: 0 };
  }

  return { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS - attempts };
}

async function clearFailedAttempts(): Promise<void> {
  await Promise.all([
    storage.removeItem(LOCKOUT_KEY),
    storage.removeItem(ATTEMPTS_KEY),
  ]);
}

// ── Public API ─────────────────────────────────────────────────────────────────
export async function hasPinSetup(): Promise<boolean> {
  const val = await storage.getItem(PIN_KEY);
  return !!val;
}

export async function savePin(pin: string): Promise<void> {
  const salt   = await getOrCreateSalt();
  const hashed = await hashPin(pin, salt);
  await storage.setItem(PIN_KEY, hashed);
  await clearFailedAttempts(); // reset on new PIN set
}

export type VerifyResult = {
  success: boolean;
  lockout: LockoutState;
};

export async function verifyPin(pin: string): Promise<VerifyResult> {
  // Check lockout first
  const lockout = await getLockoutState();
  if (lockout.isLocked) {
    return { success: false, lockout };
  }

  const stored = await storage.getItem(PIN_KEY);
  if (!stored) {
    // No PIN set — allow through
    return { success: true, lockout: { isLocked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS } };
  }

  const salt   = await storage.getItem(PIN_SALT_KEY) ?? 'cw_salt_2024';
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
    storage.removeItem(PIN_KEY),
    storage.removeItem(PIN_SALT_KEY),
    storage.removeItem(LOCKOUT_KEY),
    storage.removeItem(ATTEMPTS_KEY),
  ]);
}
