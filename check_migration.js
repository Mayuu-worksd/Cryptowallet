require('dotenv').config({ path: './admin-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('codego_webhooks_log').select('id').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Success! codego_webhooks_log table exists.');
  }
}
check();
