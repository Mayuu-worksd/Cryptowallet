const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  const targetAddress = '0xbF0603aDe100dea85e6dE47f8c46c8Ce55Bb4D01'.toLowerCase();

  console.log('--- 1. Testing vccService.getCard ---');
  try {
    const { data, error } = await supabase
      .from('vcc_cards')
      .select('*')
      .eq('wallet_address', targetAddress)
      .neq('card_status', 'terminated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log('vccService.getCard result:', { data, error });
  } catch (err) {
    console.error('vccService.getCard exception:', err.message);
  }

  console.log('\n--- 2. Testing dbCardService.getCard ---');
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('wallet_address', targetAddress)
      .maybeSingle();
    console.log('dbCardService.getCard result:', { data, error });
  } catch (err) {
    console.error('dbCardService.getCard exception:', err.message);
  }

  console.log('\n--- 3. Testing txService.getAll ---');
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', targetAddress)
      .order('created_at', { ascending: false })
      .limit(500);
    console.log('txService.getAll result:', { count: data?.length, error });
  } catch (err) {
    console.error('txService.getAll exception:', err.message);
  }

  console.log('\n--- 4. Testing cardVariantService.getVariants ---');
  try {
    const { data, error } = await supabase
      .from('card_variants')
      .select('*')
      .eq('is_active', true);
    console.log('cardVariantService.getVariants result:', { count: data?.length, error });
  } catch (err) {
    console.error('cardVariantService.getVariants exception:', err.message);
  }

  console.log('\n--- 5. Testing kycService.getStatus ---');
  try {
    const { data, error } = await supabase.rpc('get_kyc_status', { p_wallet: targetAddress });
    console.log('kycService.getStatus result:', { data, error });
  } catch (err) {
    console.error('kycService.getStatus exception:', err.message);
  }
}

main();
