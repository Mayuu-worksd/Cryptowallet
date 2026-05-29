const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Querying column types for wallet_profiles...');
  const { data, error } = await supabase.rpc('get_table_columns_info', { p_table: 'wallet_profiles' });
  if (error) {
    // If the RPC doesn't exist, we can try querying info schema via custom select or just a simple description
    console.log('RPC get_table_columns_info not found, trying raw select...');
    const { data: cols, error: err2 } = await supabase
      .from('wallet_profiles')
      .select('*')
      .limit(1);
    if (err2) {
      console.error('Error:', err2);
    } else {
      console.log('Row structure:', cols[0] ? Object.keys(cols[0]).map(k => `${k}: ${typeof cols[0][k]} (${JSON.stringify(cols[0][k])})`) : 'Empty');
    }
  } else {
    console.log(data);
  }
}

run();
