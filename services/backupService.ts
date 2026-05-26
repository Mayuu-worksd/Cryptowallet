import { ethers } from 'ethers';
import { supabase } from './supabaseClient';

export interface EncryptedPayload {
  encryptedMnemonic: string;
  walletAddress: string;
  email: string;
  passwordHash: string;
  salt: string;
}

export const backupService = {
  deriveKey(password: string, salt: string): string {
    const passwordBytes = ethers.toUtf8Bytes(password);
    const saltBytes = ethers.toUtf8Bytes(salt);
    return ethers.pbkdf2(passwordBytes, saltBytes, 10000, 32, 'sha256');
  },

  encryptText(text: string, keyHex: string): string {
    const textBytes = ethers.toUtf8Bytes(text);
    const keyBytes = ethers.getBytes(keyHex);
    const encryptedBytes = new Uint8Array(textBytes.length);
    let state = ethers.keccak256(keyBytes);
    for (let i = 0; i < textBytes.length; i++) {
      if (i > 0 && i % 32 === 0) state = ethers.keccak256(state);
      encryptedBytes[i] = textBytes[i] ^ ethers.getBytes(state)[i % 32];
    }
    return ethers.hexlify(encryptedBytes);
  },

  decryptText(cipherHex: string, keyHex: string): string {
    const cipherBytes = ethers.getBytes(cipherHex);
    const keyBytes = ethers.getBytes(keyHex);
    const decryptedBytes = new Uint8Array(cipherBytes.length);
    let state = ethers.keccak256(keyBytes);
    for (let i = 0; i < cipherBytes.length; i++) {
      if (i > 0 && i % 32 === 0) state = ethers.keccak256(state);
      decryptedBytes[i] = cipherBytes[i] ^ ethers.getBytes(state)[i % 32];
    }
    return ethers.toUtf8String(decryptedBytes);
  },

  /**
   * Sends a real OTP to the user's email via Supabase Auth.
   * Supabase dispatches a 6-digit code to the inbox.
   */
  async sendOTP(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        // If user doesn't exist in auth, create them first then resend
        if (error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('no user')) {
          const { error: err2 } = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: { shouldCreateUser: true },
          });
          if (err2) return { success: false, error: err2.message };
          return { success: true };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to send verification code.' };
    }
  },

  /**
   * Verifies the OTP code entered by the user against Supabase Auth.
   * No backdoors, no local fallback — real verification only.
   */
  async verifyOTP(email: string, token: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    try {
      // Try 'email' type first (used for magic link / OTP sign-in)
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      });
      if (!error) return { success: true };

      // Fallback: try 'magiclink' type
      const { error: err2 } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'magiclink',
      });
      if (!err2) return { success: true };

      return { success: false, error: 'Invalid or expired verification code. Please request a new one.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Verification failed.' };
    }
  },

  /**
   * Encrypts and uploads a secure wallet backup payload.
   * Performs local encryption, uploads the payload as a JSON file to Supabase storage,
   * and creates a record in the database backup_records table.
   */
  async uploadBackup(walletAddress: string, email: string, password: string, mnemonic: string): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanAddress = walletAddress.trim().toLowerCase();
      const cleanEmail = email.trim().toLowerCase();

      // 1. Generate salt and derive keys
      const salt = ethers.hexlify(ethers.randomBytes(16));
      const keyHex = this.deriveKey(password, salt);
      
      // Encrypt raw mnemonic locally (never stored or sent in plaintext)
      const encryptedMnemonic = this.encryptText(mnemonic, keyHex);
      
      // Hash password securely so we can check password validity before attempting decryption during recovery
      const passwordHash = ethers.id(password + salt);

      const payload: EncryptedPayload = {
        encryptedMnemonic,
        walletAddress: cleanAddress,
        email: cleanEmail,
        passwordHash,
        salt,
      };

      const payloadString = JSON.stringify(payload);

      // 2. Upload JSON to Supabase Storage Bucket
      const storagePath = `${cleanAddress}/backup.json`;
      const blob = new Blob([payloadString], { type: 'application/json' } as any);
      
      // Upload with upsert enabled so users can overwrite their backups securely
      const { error: storageError } = await supabase.storage
        .from('wallet-backups')
        .upload(storagePath, blob, {
          contentType: 'application/json',
          upsert: true,
        });

      if (storageError) {
        console.warn('[BackupService] Storage upload error, falling back to database-only:', storageError.message);
      }

      // 3. Upsert DB Record in backup_records table
      const { error: dbError } = await supabase
        .from('backup_records')
        .upsert({
          wallet_address: cleanAddress,
          email: cleanEmail,
          encrypted_backup: payloadString, // Save full payload securely in DB as redundant backup
          password_hash: passwordHash,
          salt,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'wallet_address',
        });

      if (dbError) {
        throw new Error(dbError.message);
      }

      return { success: true };
    } catch (e: any) {
      console.error('[BackupService] Upload failed:', e?.message || e);
      return { success: false, error: e?.message || 'Failed to complete cloud backup.' };
    }
  },

  /**
   * Downloads and decrypts the backup.
   * Takes the email and backup password, fetches the encrypted payload, verifies the password,
   * decrypts the mnemonic locally, and returns it.
   */
  async recoverWallet(email: string, password: string): Promise<{ success: boolean; mnemonic?: string; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Fetch record from backup_records by email
      const { data, error } = await supabase
        .from('backup_records')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return { success: false, error: 'No wallet backup found matching this email address.' };
      }

      const payload: EncryptedPayload = JSON.parse(data.encrypted_backup);

      // 2. Verify password hash
      const derivedHash = ethers.id(password + payload.salt);
      if (derivedHash !== payload.passwordHash) {
        return { success: false, error: 'Incorrect backup password. Please verify and try again.' };
      }

      // 3. Decrypt mnemonic locally
      const keyHex = this.deriveKey(password, payload.salt);
      const decryptedMnemonic = this.decryptText(payload.encryptedMnemonic, keyHex);

      // 4. Validate mnemonic integrity
      const words = decryptedMnemonic.split(' ');
      if (words.length !== 12 && words.length !== 24) {
        return { success: false, error: 'Decrypted data is corrupted or invalid.' };
      }

      return { success: true, mnemonic: decryptedMnemonic };
    } catch (e: any) {
      console.error('[BackupService] Recovery failed:', e?.message || e);
      return { success: false, error: e?.message || 'An error occurred during recovery.' };
    }
  },

  /**
   * Check if a backup exists for a specific wallet address.
   */
  async checkBackupExists(walletAddress: string): Promise<boolean> {
    try {
      const cleanAddress = walletAddress.trim().toLowerCase();
      const { data, error } = await supabase
        .from('backup_records')
        .select('wallet_address')
        .eq('wallet_address', cleanAddress)
        .maybeSingle();

      if (error || !data) return false;
      return true;
    } catch {
      return false;
    }
  }
};
