const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const walletAddress = '0x351028A22C876E0431b30921c0dD0a836a14899E'.toLowerCase();

async function run() {
  console.log('Fixing profile for:', walletAddress);
  
  // First, get the profile
  const { data: profile, error: err1 } = await supabase.rpc('get_wallet_profile', { p_wallet: walletAddress });
  if (err1) {
    console.error('get_wallet_profile error:', err1);
    return;
  }
  
  console.log('Current profile:', JSON.stringify(profile, null, 2));
  
  let currentBals = profile.token_balances;
  if (typeof currentBals === 'string') {
    try {
      currentBals = JSON.parse(currentBals);
    } catch {
      currentBals = { ETH: 1.5, USDT: 200 };
    }
  }
  
  let currentLocked = profile.locked_balances;
  if (typeof currentLocked === 'string') {
    try {
      currentLocked = JSON.parse(currentLocked);
    } catch {
      currentLocked = {};
    }
  }

  console.log('Updating with native objects:', currentBals, currentLocked);

  // Directly update using supabase client to avoid RPC function double-serialization
  const { error: err2 } = await supabase
    .from('wallet_profiles')
    .update({ 
      token_balances: currentBals,
      locked_balances: currentLocked
    })
    .eq('wallet_address', walletAddress);

  if (err2) {
    console.error('Update error:', err2);
  } else {
    console.log('Successfully updated profile in database!');
    const { data: updated } = await supabase.rpc('get_wallet_profile', { p_wallet: walletAddress });
    console.log('New profile details:', JSON.stringify(updated, null, 2));
  }
}

run();
