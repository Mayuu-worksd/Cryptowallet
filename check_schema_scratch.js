require('dotenv').config({ path: './admin-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const tables = ['vcc_cards', 'codego_cards', 'codego_cardholders', 'kyc', 'fiat_deposits', 'fiat_withdrawals', 'transactions', 'codego_webhooks_log', 'cards'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': ERROR/MISSING (${error.message})`);
    } else {
      console.log(`Table '${table}': EXISTS (rows: ${data.length > 0 ? '>= 1' : '0'})`);
      if (data.length > 0) {
        console.log(`Sample columns for '${table}':`, Object.keys(data[0]));
      }
    }
  }
}

checkSchema();
