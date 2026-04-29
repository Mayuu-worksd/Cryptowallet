import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// ─── DEMO CONFIG ─────────────────────────────────────────────────────────────
// Replace these with your actual Supabase project URL and anon key.
// Get them from: https://supabase.com → Project Settings → API
export const SUPABASE_URL = 'https://hxmacphgbpedazdvgdnz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';

// ─── Storage adapter for React Native ────────────────────────────────────────
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
  realtime: {
    // Disable realtime WebSocket — not needed for this app and
    // avoids the ws/zlib Node built-in issue on React Native.
    params: { eventsPerSecond: 0 },
  } as any,
});
