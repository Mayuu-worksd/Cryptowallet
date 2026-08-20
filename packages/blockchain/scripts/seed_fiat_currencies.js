const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing in .env file!');
  process.exit(1);
}

const supabaseJsPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/@supabase/supabase-js');
if (!fs.existsSync(supabaseJsPath)) {
  console.error(`❌ Supabase JS SDK not found at: ${supabaseJsPath}`);
  process.exit(1);
}
const { createClient } = require(supabaseJsPath);
const supabase = createClient(supabaseUrl, supabaseKey);

const ADDRESSES_PATH = path.resolve(__dirname, '../deployed_addresses.json');

async function seed() {
  console.log('=================================================');
  console.log('   SEEDING FIAT CURRENCIES TO SUPABASE          ');
  console.log('=================================================\n');

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ deployed_addresses.json not found. Run deploy_fiat_currencies.js first.');
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));

  const currencies = [
    { code: 'PKR', key: 'pkrProxy' },
    { code: 'AED', key: 'aedProxy' },
    { code: 'CNY', key: 'cnyProxy' },
    { code: 'RUB', key: 'rubProxy' },
    { code: 'UZS', key: 'uzsProxy' },
    { code: 'VND', key: 'vndProxy' },
    { code: 'IDR', key: 'idrProxy' },
    { code: 'PHP', key: 'phpProxy' },
  ];

  for (const { code, key } of currencies) {
    const contractAddress = addresses[key];
    if (!contractAddress) {
      console.warn(`⚠️  No address found for ${code} (key: ${key}) — skipping.`);
      continue;
    }

    const { error } = await supabase
      .from('token_contracts')
      .upsert({
        currency_code: code,
        network_name: 'Sepolia',
        contract_address: contractAddress,
        decimals: 6,
        is_enabled: false, // Disabled until E2E verification passes
      }, { onConflict: 'currency_code,network_name' });

    if (error) {
      console.error(`❌ Failed to seed ${code}: ${error.message}`);
    } else {
      console.log(`✅ ${code} registered: ${contractAddress} (is_enabled: false)`);
    }
  }

  console.log('\n✅ Supabase seeding complete.');
  console.log('⚠️  All currencies seeded with is_enabled=false.');
  console.log('   Run test_fiat_currencies_e2e.js and set is_enabled=true per currency after verification.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exitCode = 1;
});
