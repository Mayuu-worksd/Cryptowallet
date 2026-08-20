const fs = require('fs');
const path = require('path');

// Load env variables from root
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing in .env file!');
  process.exit(1);
}

// Load supabase client from admin-dashboard workspace to avoid package install issues
const supabaseJsPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/@supabase/supabase-js');
if (!fs.existsSync(supabaseJsPath)) {
  console.error(`❌ Supabase JS SDK not found at: ${supabaseJsPath}`);
  process.exit(1);
}
const { createClient } = require(supabaseJsPath);

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding THB token configuration to Supabase token_contracts...');
  
  const { data, error } = await supabase
    .from('token_contracts')
    .upsert({
      currency_code: 'THB',
      network_name: 'Sepolia',
      contract_address: '0x288cd557B7EF9CF317DbEC59d425C23913ab6BeB',
      decimals: 6,
      is_enabled: true
    }, { onConflict: 'currency_code,network_name' });

  if (error) {
    console.error('❌ Seeding failed:', error.message);
  } else {
    console.log('✅ Seeding completed successfully. THB on Sepolia is registered.');
  }
}

seed();
