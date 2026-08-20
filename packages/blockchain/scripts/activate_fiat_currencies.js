const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { createClient } = require(path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/@supabase/supabase-js'));

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const CODES = ['PKR', 'AED', 'CNY', 'RUB', 'UZS', 'VND', 'IDR', 'PHP'];

async function main() {
  for (const code of CODES) {
    const { error } = await supabase
      .from('token_contracts')
      .update({ is_enabled: true })
      .eq('currency_code', code)
      .eq('network_name', 'Sepolia');
    if (error) console.log('FAIL ' + code + ': ' + error.message);
    else console.log('ACTIVATED ' + code);
  }

  const { data, error } = await supabase
    .from('token_contracts')
    .select('currency_code, contract_address, is_enabled')
    .in('currency_code', ['THB', 'PKR', 'AED', 'CNY', 'RUB', 'UZS', 'VND', 'IDR', 'PHP'])
    .eq('network_name', 'Sepolia')
    .order('currency_code');

  if (error) { console.error('Query failed:', error.message); return; }
  console.log('\nFinal Supabase state (Sepolia):');
  for (const row of data) {
    console.log(row.currency_code.padEnd(4), row.is_enabled ? 'ENABLED ' : 'DISABLED', row.contract_address);
  }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
