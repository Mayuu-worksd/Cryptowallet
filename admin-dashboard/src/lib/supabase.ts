import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
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
