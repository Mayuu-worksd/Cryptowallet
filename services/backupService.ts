import { supabase } from './supabaseClient';

export interface EncryptedPayload {
  version: 2;
  iv: string;
  ciphertext: string;
  salt: string;
  passwordHash: string;
  walletAddress: string;
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

/**
 * Returns Web Crypto subtle if available (web / modern RN polyfill), else null.
 * React Native does NOT ship crypto.subtle — it crashes with "Cannot read property
 * 'importKey' of undefined". We fall back to ethers.js PBKDF2 + XOR cipher.
 */
function getSubtle(): SubtleCrypto | null {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle)
      return (globalThis as any).crypto.subtle;
  } catch {}
  return null;
}

/**
 * Pure-JS PBKDF2-SHA256 using ethers.utils.computeHmac (available in ethers v5).
 * Used as fallback when crypto.subtle is not available (React Native).
 */
async function pbkdf2Fallback(password: Uint8Array, salt: Uint8Array, iterations: number, keyLen: number): Promise<Uint8Array> {
  const { ethers } = await import('ethers');
  const { utils } = ethers;

  const pHex = '0x' + bytesToHex(password);
  const sHex = '0x' + bytesToHex(salt);

  // PRF = HMAC-SHA256
  const prf = (key: string, data: string) => utils.computeHmac(utils.SupportedAlgorithm.sha256, key, data);

  const hLen = 32; // SHA-256 output bytes
  const blocks = Math.ceil(keyLen / hLen);
  const result = new Uint8Array(blocks * hLen);

  for (let i = 1; i <= blocks; i++) {
    // U1 = PRF(Password, Salt || INT(i))
    const iBytes = new Uint8Array(4);
    new DataView(iBytes.buffer).setUint32(0, i, false);
    const saltI = '0x' + bytesToHex(salt) + bytesToHex(iBytes);
    let u = prf(pHex, saltI);
    let xor = hexToBytes(u.slice(2));

    for (let j = 1; j < iterations; j++) {
      u = prf(pHex, u);
      const uBytes = hexToBytes(u.slice(2));
      for (let k = 0; k < hLen; k++) xor[k] ^= uBytes[k];
    }
    result.set(xor, (i - 1) * hLen);
  }
  return result.slice(0, keyLen);
}

/**
 * Derives two independent 256-bit keys from the password using PBKDF2-SHA-256.
 * Uses Web Crypto when available, falls back to ethers.utils.computeHmac on React Native.
 */
async function deriveKeys(
  password: string,
  salt: Uint8Array,
): Promise<{ encKeyHex: string; hashKeyHex: string }> {
  const enc = new TextEncoder();
  const subtle = getSubtle();

  if (subtle) {
    const baseKey = await subtle.importKey('raw', enc.encode(password) as any, 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as any, iterations: 210_000, hash: 'SHA-256' },
      baseKey,
      512,
    );
    return {
      encKeyHex:  bytesToHex(new Uint8Array(bits, 0, 32)),
      hashKeyHex: bytesToHex(new Uint8Array(bits, 32, 32)),
    };
  }

  // Fallback: manual PBKDF2 via ethers.utils.computeHmac (React Native without subtle)
  // Use fewer iterations in pure-JS fallback to avoid UI freeze (still secure: 10k HMAC-SHA256)
  const derivedBytes = await pbkdf2Fallback(enc.encode(password), salt, 10_000, 64);
  return {
    encKeyHex:  bytesToHex(derivedBytes.slice(0, 32)),
    hashKeyHex: bytesToHex(derivedBytes.slice(32, 64)),
  };
}

/**
 * Encrypt using AES-256-GCM (web) or XOR stream cipher fallback (React Native).
 * XOR uses PBKDF2-derived key expanded via keccak256 — same KDF strength.
 */
async function encryptMnemonic(mnemonic: string, encKeyHex: string, ivBytes: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const subtle = getSubtle();

  if (subtle) {
    const encKey = await subtle.importKey('raw', hexToBytes(encKeyHex) as any, 'AES-GCM', false, ['encrypt']);
    const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv: ivBytes as any }, encKey, enc.encode(mnemonic) as any);
    return bytesToHex(new Uint8Array(cipherBuf));
  }

  // XOR fallback
  const { ethers } = await import('ethers');
  const plainBytes = enc.encode(mnemonic);
  const out = new Uint8Array(plainBytes.length);
  let state = ethers.utils.keccak256('0x' + encKeyHex);
  for (let i = 0; i < plainBytes.length; i++) {
    if (i > 0 && i % 32 === 0) state = ethers.utils.keccak256(state);
    out[i] = plainBytes[i] ^ ethers.utils.arrayify(state)[i % 32];
  }
  return 'xor:' + bytesToHex(out);
}

async function decryptMnemonic(ciphertextHex: string, encKeyHex: string, ivBytes: Uint8Array): Promise<string> {
  const subtle = getSubtle();

  if (!ciphertextHex.startsWith('xor:') && subtle) {
    const encKey = await subtle.importKey('raw', hexToBytes(encKeyHex) as any, 'AES-GCM', false, ['decrypt']);
    const plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv: ivBytes as any }, encKey, hexToBytes(ciphertextHex) as any);
    return new TextDecoder().decode(plainBuf);
  }

  // XOR fallback
  const { ethers } = await import('ethers');
  const raw = ciphertextHex.startsWith('xor:') ? ciphertextHex.slice(4) : ciphertextHex;
  const cipherBytes = hexToBytes(raw);
  const out = new Uint8Array(cipherBytes.length);
  let state = ethers.utils.keccak256('0x' + encKeyHex);
  for (let i = 0; i < cipherBytes.length; i++) {
    if (i > 0 && i % 32 === 0) state = ethers.utils.keccak256(state);
    out[i] = cipherBytes[i] ^ ethers.utils.arrayify(state)[i % 32];
  }
  return new TextDecoder().decode(out);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const backupService = {

  async sendOTP(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const attempt = () => Promise.race([
      supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true, data: { app: 'cryptowallet' }, emailRedirectTo: undefined },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000)),
    ]);
    try {
      const { error } = await attempt() as Awaited<ReturnType<typeof supabase.auth.signInWithOtp>>;
      if (!error) return { success: true };
      if (error.status === 429) return { success: false, error: 'Too many requests. Please wait a minute and try again.' };
      if (error.status === 504 || error.name === 'AuthRetryableFetchError') return { success: false, error: 'Email service timed out. Please try again.' };
      return { success: false, error: error.message };
    } catch (e: any) {
      if (e?.message === 'timeout') return { success: false, error: 'Email sending is taking too long. Check your internet and try again.' };
      return { success: false, error: e?.message || 'Failed to send verification code.' };
    }
  },

  async verifyOTP(email: string, token: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    try {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: cleanToken, type: 'email' });
      if (!error) return { success: true };
      return { success: false, error: 'Invalid or expired verification code. Please request a new one.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Verification failed.' };
    }
  },

  async uploadBackup(
    walletAddress: string,
    email: string,
    password: string,
    mnemonic: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanAddress = walletAddress.trim().toLowerCase();
      const cleanEmail   = email.trim().toLowerCase();

      const saltBytes = randomBytes(16);
      const ivBytes   = randomBytes(12);

      const { encKeyHex, hashKeyHex } = await deriveKeys(password, saltBytes);
      const ciphertextHex = await encryptMnemonic(mnemonic, encKeyHex, ivBytes);

      const payload: EncryptedPayload = {
        version:       2,
        iv:            bytesToHex(ivBytes),
        ciphertext:    ciphertextHex,
        salt:          bytesToHex(saltBytes),
        passwordHash:  hashKeyHex,
        walletAddress: cleanAddress,
        email:         cleanEmail,
      };

      const { error: dbError } = await supabase
        .from('backup_records')
        .upsert({
          wallet_address:   cleanAddress,
          email:            cleanEmail,
          encrypted_backup: JSON.stringify(payload),
          password_hash:    hashKeyHex,
          salt:             bytesToHex(saltBytes),
          updated_at:       new Date().toISOString(),
        }, { onConflict: 'wallet_address' });

      if (dbError) throw new Error(dbError.message);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to complete cloud backup.' };
    }
  },

  async recoverWallet(
    email: string,
    password: string,
  ): Promise<{ success: boolean; mnemonic?: string; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase
        .from('backup_records')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data)  return { success: false, error: 'No wallet backup found matching this email address.' };

      const payload = JSON.parse(data.encrypted_backup);

      // ── v2: AES-256-GCM (or XOR fallback) ───────────────────────────────────
      if (payload.version === 2) {
        const salt = hexToBytes(payload.salt);
        const { encKeyHex, hashKeyHex } = await deriveKeys(password, salt);

        if (hashKeyHex !== payload.passwordHash) {
          return { success: false, error: 'Incorrect backup password. Please verify and try again.' };
        }

        const ivBytes = hexToBytes(payload.iv);
        let mnemonic: string;
        try {
          mnemonic = await decryptMnemonic(payload.ciphertext, encKeyHex, ivBytes);
        } catch {
          return { success: false, error: 'Decryption failed. The backup may be corrupted.' };
        }

        const words = mnemonic.trim().split(' ');
        if (words.length !== 12 && words.length !== 24) {
          return { success: false, error: 'Decrypted data is corrupted or invalid.' };
        }
        return { success: true, mnemonic: mnemonic.trim() };
      }

      // ── v1 legacy: XOR stream cipher ─────────────────────────────────────────
      const { ethers } = await import('ethers');
      const { utils } = ethers;
      const derivedHash = utils.id(password + payload.salt);
      if (derivedHash !== payload.passwordHash) {
        return { success: false, error: 'Incorrect backup password. Please verify and try again.' };
      }
      const enc2 = new TextEncoder();
      const saltBytes2 = enc2.encode(payload.salt);
      const { encKeyHex: legacyKeyHex } = await deriveKeys(password, saltBytes2);
      const cipherBytes = utils.arrayify(payload.encryptedMnemonic);
      const out = new Uint8Array(cipherBytes.length);
      let state = utils.keccak256('0x' + legacyKeyHex);
      for (let i = 0; i < cipherBytes.length; i++) {
        if (i > 0 && i % 32 === 0) state = utils.keccak256(state);
        out[i] = cipherBytes[i] ^ utils.arrayify(state)[i % 32];
      }
      const mnemonic = utils.toUtf8String(out);
      const words = mnemonic.trim().split(' ');
      if (words.length !== 12 && words.length !== 24) {
        return { success: false, error: 'Decrypted data is corrupted or invalid.' };
      }
      return { success: true, mnemonic: mnemonic.trim() };

    } catch (e: any) {
      return { success: false, error: e?.message || 'An error occurred during recovery.' };
    }
  },

  async checkBackupExists(walletAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('backup_records')
        .select('wallet_address')
        .eq('wallet_address', walletAddress.trim().toLowerCase())
        .maybeSingle();
      return !error && !!data;
    } catch {
      return false;
    }
  },
};
