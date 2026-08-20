const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase env variables not found.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Querying admin_networks table...');
  const { data: networks, error } = await supabase
    .from('admin_networks')
    .select('*');
  
  if (error) {
    console.error('Error fetching admin_networks:', error.message);
    return;
  }

  console.log(`Found ${networks.length} networks:`);
  console.log(JSON.stringify(networks, null, 2));
}

main().catch(console.error);
