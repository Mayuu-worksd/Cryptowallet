require('dotenv').config({ path: './admin-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('fiat_crypto_requests').select(`*, profile:wallet_address(wallet_name)`).limit(1);
  if (error) {
    console.error('Error with wallet_name:', error.message);
  } else {
    console.log('Success with wallet_name', data);
  }
}
check();
