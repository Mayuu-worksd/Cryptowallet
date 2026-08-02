import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

let storageAdapter: any;
if (Platform.OS === 'web') {
  storageAdapter = {
    getItem:    (k: string) => Promise.resolve(localStorage.getItem(k)),
    setItem:    (k: string, v: string) => { localStorage.setItem(k, v); return Promise.resolve(); },
    removeItem: (k: string) => { localStorage.removeItem(k); return Promise.resolve(); },
  };
} else {
  const AS = require('@react-native-async-storage/async-storage').default;
  storageAdapter = AS;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── RLS wallet context ───────────────────────────────────────────────────────
// NEVER cache the wallet address — always call set_wallet before every
// Supabase query that touches wallet-scoped tables.
// This prevents stale RLS sessions after wallet import/switch.
let _currentWallet = '';

export async function setWallet(walletAddress: string): Promise<void> {
  const addr = walletAddress.toLowerCase().trim();
  if (!addr) return;
  try {
    await supabase.rpc('set_wallet', { wallet: addr });
    _currentWallet = addr;
  } catch (e: any) {
    console.warn('[supabaseClient] set_wallet failed:', e?.message);
    _currentWallet = '';
  }
}

// Call this on logout/wallet switch to invalidate the session
export function clearWalletSession(): void {
  _currentWallet = '';
  // Fire-and-forget to clear the Postgres session variable
  void supabase.rpc('set_wallet', { wallet: '' });
}

export function getCurrentWallet(): string {
  return _currentWallet;
}

// ─── Signed URL helper for KYC docs (private bucket) ─────────────────────────
export async function getKYCSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('kyc-docs')
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(`Failed to get signed URL: ${error?.message}`);
  return data.signedUrl;
}

export function extractStoragePath(publicUrl: string): string {
  // Handle already-relative paths (e.g. 'kyc/abc/doc.jpg' or 'business_kyc/abc/doc.jpg')
  if (!publicUrl.startsWith('http')) return publicUrl;
  const marker = '/object/public/kyc-docs/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return publicUrl;
  return publicUrl.slice(idx + marker.length);
}
