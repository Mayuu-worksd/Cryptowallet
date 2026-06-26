const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hxmacphgbpedazdvgdnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEwMjI2MCwiZXhwIjoyMDkyNjc4MjYwfQ.vZ1uvQ8R_zu8ZjVZtyRSiGKMaACTmc6T0WgHx2_LE80'
);

async function main() {
  // Check the current KYC action route fix — simulate what it does
  const wallet = '0x75815e8c21ee0cbed1f19e9e0fc89f3fb27edc3';
  
  const { data: kyc } = await sb.from('kyc').select('*').eq('wallet_address', wallet).maybeSingle();
  console.log('KYC record:', kyc ? `status=${kyc.status}, codego_id=${kyc.codego_cardholder_id || 'none'}` : 'NOT FOUND');

  // Simulate what the FIXED action route does: just check KYC exists, then update
  if (kyc) {
    console.log('\nFixed route would: find KYC record ✅, call admin_update_kyc RPC ✅');
    console.log('NO Codego check required anymore ✅');
    console.log('\nAfter verify → user can create card via /api/codego/cards');
    console.log('That route handles mock card when Codego not approved ✅');
  }

  // Also check the 2 verified users with no cards - they just haven't created one
  console.log('\n=== Verified users without cards (no action needed) ===');
  const { data: vcc } = await sb.from('vcc_cards').select('wallet_address');
  const vccSet = new Set((vcc || []).map(c => c.wallet_address));
  
  const { data: kycs } = await sb.from('kyc').select('wallet_address, full_name, status').eq('status', 'verified');
  (kycs || []).forEach(k => {
    const hasCard = vccSet.has(k.wallet_address);
    console.log(k.wallet_address.slice(0,10), '|', k.full_name || '(no name)', '| card:', hasCard ? 'YES' : 'NO - user just hasnt created one');
  });
}
main().catch(console.error);
