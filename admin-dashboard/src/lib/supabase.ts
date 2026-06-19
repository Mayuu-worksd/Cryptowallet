import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Admin dashboard uses service_role key — bypasses RLS so admin can write to any table.
  // NEVER use this key in the mobile app.
  const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});

// Helper to get signed URLs for files in private bucket
export async function getKYCSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('kyc-docs')
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    console.error('Failed to get signed URL:', error);
    // Return standard public URL fallback in case signed URL fails
    const { data: publicData } = supabase.storage.from('kyc-docs').getPublicUrl(storagePath);
    return publicData.publicUrl;
  }
  return data.signedUrl;
}

export function extractStoragePath(publicUrl: string): string {
  if (!publicUrl) return '';
  if (!publicUrl.startsWith('http')) return publicUrl;
  const marker = '/object/public/kyc-docs/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return publicUrl;
  return publicUrl.slice(idx + marker.length);
}
