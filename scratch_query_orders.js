const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Querying open p2p_orders...');
  const { data, error } = await supabase.from('p2p_orders').select('*').eq('status', 'open');
  if (error) {
    console.error('Error fetching orders:', error);
  } else {
    console.log(`Fetched ${data.length} open orders:`);
    console.log(data.map(o => ({ id: o.id, seller: o.seller_wallet, token: o.token, amount: o.amount, fiat: o.fiat_currency, network: o.network })));
  }
}

run();
