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

// ── Pure-JS SHA-256 (works on Hermes/Android where crypto.subtle is unavailable) ──
function sha256(str: string): string {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  // UTF-8 encode
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0|(c>>6)); bytes.push(0x80|(c&0x3f)); }
    else { bytes.push(0xe0|(c>>12)); bytes.push(0x80|((c>>6)&0x3f)); bytes.push(0x80|(c&0x3f)); }
  }
  const len = bytes.length;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const bitLen = len * 8;
  bytes.push(0,0,0,0,(bitLen/0x100000000)>>>0,(bitLen>>>24)&0xff,(bitLen>>>16)&0xff,(bitLen>>>8)&0xff,bitLen&0xff);
  // Wait — fix last 8 bytes properly
  bytes.splice(bytes.length - 9, 9);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(64).fill(0);
    for (let j = 0; j < 16; j++) w[j] = (bytes[i+j*4]<<24)|(bytes[i+j*4+1]<<16)|(bytes[i+j*4+2]<<8)|bytes[i+j*4+3];
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3);
      const s1 = rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10);
      w[j] = (w[j-16]+s0+w[j-7]+s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch = (e&f)^(~e&g);
      const t1 = (h+S1+ch+K[j]+w[j]) >>> 0;
      const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0+maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  return H.map(v => v.toString(16).padStart(8,'0')).join('');
}

// ── Per-device random salt ─────────────────────────────────────────────────────
async function getOrCreateSalt(): Promise<string> {
  const existing = await secureStorage.getItem(PIN_SALT_KEY);
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const salt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  await secureStorage.setItem(PIN_SALT_KEY, salt);
  return salt;
}

// ── Hash using pure-JS SHA-256 (Hermes-safe) ──────────────────────────────────
async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256(pin + salt);
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
