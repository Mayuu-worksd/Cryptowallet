const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const walletAddress = '0x351028A22C876E0431b30921c0dD0a836a14899E'.toLowerCase();

async function run() {
  console.log('Querying profile for:', walletAddress);
  await supabase.rpc('set_wallet', { wallet: walletAddress });
  const { data: profile, error: err1 } = await supabase.rpc('get_wallet_profile', { p_wallet: walletAddress });
  if (err1) {
    console.error('get_wallet_profile error:', err1);
  } else {
    console.log('Profile details fields:');
    console.log('wallet_name:', profile.wallet_name);
    console.log('account_type:', profile.account_type);
    console.log('token_balances:', profile.token_balances);
  }
}

run();
