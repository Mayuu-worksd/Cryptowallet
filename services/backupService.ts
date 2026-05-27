import { supabase } from './supabaseClient';

export interface EncryptedPayload {
  version: 2;
  iv: string;           // 12-byte AES-GCM IV, hex-encoded
  ciphertext: string;   // AES-256-GCM ciphertext, hex-encoded
  salt: string;         // 16-byte PBKDF2 salt, hex-encoded
  passwordHash: string; // PBKDF2-derived verifier (separate key), hex-encoded
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
  crypto.getRandomValues(buf);
  return buf;
}

/**
 * Derives two independent 256-bit keys from the password using PBKDF2-SHA-256:
 *   encKey  — used for AES-GCM encryption
 *   hashKey — used only for password verification (never touches the ciphertext)
 * Using two separate keys prevents the verifier from leaking anything about the encryption key.
 */
async function deriveKeys(
  password: string,
  salt: ArrayBuffer | Uint8Array,
): Promise<{ encKey: CryptoKey; hashKeyHex: string }> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as ArrayBuffer, iterations: 210_000, hash: 'SHA-256' },
    baseKey,
    512,
  );

  const encRaw  = new Uint8Array(bits, 0, 32);
  const hashRaw = new Uint8Array(bits, 32, 32);

  const encKey     = await crypto.subtle.importKey('raw', encRaw as unknown as ArrayBuffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const hashKeyHex = bytesToHex(hashRaw);

  return { encKey, hashKeyHex };
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

  /**
   * Encrypts the mnemonic with AES-256-GCM (PBKDF2 key, 210k iterations)
   * and stores only the ciphertext in Supabase — the plaintext never leaves the device.
   */
  async uploadBackup(
    walletAddress: string,
    email: string,
    password: string,
    mnemonic: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanAddress = walletAddress.trim().toLowerCase();
      const cleanEmail   = email.trim().toLowerCase();

      const saltBuf = randomBytes(16);
      const ivBuf   = randomBytes(12);
      const salt = saltBuf.buffer.slice(saltBuf.byteOffset, saltBuf.byteOffset + saltBuf.byteLength) as ArrayBuffer;
      const iv   = ivBuf.buffer.slice(ivBuf.byteOffset, ivBuf.byteOffset + ivBuf.byteLength) as ArrayBuffer;

      const { encKey, hashKeyHex } = await deriveKeys(password, new Uint8Array(salt));

      const enc        = new TextEncoder();
      const cipherBuf  = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        encKey,
        enc.encode(mnemonic),
      );

      const payload: EncryptedPayload = {
        version:      2,
        iv:           bytesToHex(new Uint8Array(iv)),
        ciphertext:   bytesToHex(new Uint8Array(cipherBuf)),
        salt:         bytesToHex(new Uint8Array(salt)),
        passwordHash: hashKeyHex,
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
          salt:             bytesToHex(new Uint8Array(salt)),
          updated_at:       new Date().toISOString(),
        }, { onConflict: 'wallet_address' });

      if (dbError) throw new Error(dbError.message);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to complete cloud backup.' };
    }
  },

  /**
   * Fetches the encrypted backup, verifies the password using the stored hash key,
   * then decrypts the mnemonic locally with AES-256-GCM.
   * Supports both v2 (AES-GCM) and legacy v1 (XOR) payloads for backward compatibility.
   */
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

      // ── v2: AES-256-GCM ──────────────────────────────────────────────────────
      if (payload.version === 2) {
        const salt = hexToBytes(payload.salt);
        const { encKey, hashKeyHex } = await deriveKeys(password, salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength));

        if (hashKeyHex !== payload.passwordHash) {
          return { success: false, error: 'Incorrect backup password. Please verify and try again.' };
        }

        const ivBytes   = hexToBytes(payload.iv);
        const cipherArr = hexToBytes(payload.ciphertext);

        let plainBuf: ArrayBuffer;
        try {
          plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: ivBytes as unknown as ArrayBuffer },
            encKey,
            cipherArr as unknown as ArrayBuffer,
          );
        } catch {
          return { success: false, error: 'Decryption failed. The backup may be corrupted.' };
        }

        const mnemonic = new TextDecoder().decode(plainBuf);
        const words    = mnemonic.trim().split(' ');
        if (words.length !== 12 && words.length !== 24) {
          return { success: false, error: 'Decrypted data is corrupted or invalid.' };
        }
        return { success: true, mnemonic: mnemonic.trim() };
      }

      // ── v1 legacy: XOR stream cipher (read-only, no new backups written in v1) ──
      const { ethers } = await import('ethers');
      const derivedHash = ethers.id(password + payload.salt);
      if (derivedHash !== payload.passwordHash) {
        return { success: false, error: 'Incorrect backup password. Please verify and try again.' };
      }
      const keyHex = ethers.pbkdf2(ethers.toUtf8Bytes(password), ethers.toUtf8Bytes(payload.salt), 10000, 32, 'sha256');
      // Legacy XOR decrypt
      const cipherBytes = ethers.getBytes(payload.encryptedMnemonic);
      const keyBytes    = ethers.getBytes(keyHex);
      const decBytes    = new Uint8Array(cipherBytes.length);
      let state = ethers.keccak256(keyBytes);
      for (let i = 0; i < cipherBytes.length; i++) {
        if (i > 0 && i % 32 === 0) state = ethers.keccak256(state);
        decBytes[i] = cipherBytes[i] ^ ethers.getBytes(state)[i % 32];
      }
      const mnemonic = ethers.toUtf8String(decBytes);
      const words    = mnemonic.trim().split(' ');
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
