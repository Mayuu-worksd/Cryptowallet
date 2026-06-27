const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './admin-dashboard/.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase credentials in env.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function run() {
  try {
    // Let's run a query to select all tables from pg_catalog or information_schema if possible
    // Wait, let's call a query on supabase.from('kyc').select('*').limit(1) to see if it works
    const { data: kyc, error: kycErr } = await supabase.from('kyc').select('*').limit(5);
    console.log("KYC rows:", kyc);

    const { data: cards, error: cardsErr } = await supabase.from('vcc_cards').select('*').limit(5);
    console.log("VCC Cards rows:", cards);

    // Let's check if there are other tables by selecting from pg_class/pg_namespace
    // Wait! Can we run an RPC that executes raw SQL?
    // Let's check if there is any table for settings or configuration.
    // Let's try to query a table named 'settings' or 'config' or 'credentials' or 'secrets'
    const tables = ['settings', 'config', 'credentials', 'secrets', 'striga_config', 'providers'];
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*').limit(5).catch(() => ({}));
      if (data) {
        console.log(`Table ${t} exists! Data:`, data);
      } else {
        console.log(`Table ${t} check failed:`, error?.message);
      }
    }
  } catch (err) {
    console.error("Error executing query:", err);
  }
}

run();
