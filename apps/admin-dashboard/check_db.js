const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: networks, error: err1 } = await supabase.from('admin_networks').select('*');
  console.log('admin_networks count:', networks ? networks.length : 0, err1 || '');
  if (networks && networks.length > 0) {
    console.log('admin_networks:', JSON.stringify(networks, null, 2));
  }

  const { data: contracts, error: err2 } = await supabase.from('token_contracts').select('*');
  console.log('token_contracts count:', contracts ? contracts.length : 0, err2 || '');
  if (contracts && contracts.length > 0) {
    console.log('token_contracts:', JSON.stringify(contracts, null, 2));
  }
}

main().catch(console.error);
