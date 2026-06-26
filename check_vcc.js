const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hxmacphgbpedazdvgdnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEwMjI2MCwiZXhwIjoyMDkyNjc4MjYwfQ.vZ1uvQ8R_zu8ZjVZtyRSiGKMaACTmc6T0WgHx2_LE80'
);

async function main() {
  const { data: vcc, error: e1 } = await sb
    .from('vcc_cards')
    .select('id, wallet_address, card_holder_name, card_status, card_variant, is_physical, created_at')
    .order('created_at', { ascending: false });

  console.log('=== vcc_cards ===');
  console.log('Total rows:', vcc ? vcc.length : 0, e1 ? 'ERROR: ' + e1.message : '');
  if (vcc) vcc.forEach((c, i) => console.log(i+1, c.wallet_address.slice(0,10)+'...', '|', c.card_holder_name, '|', c.card_status, '|', c.card_variant, '| physical:', c.is_physical, '|', c.created_at));

  const { data: cards, error: e2 } = await sb
    .from('cards')
    .select('id, wallet_address, card_type, status, created_at')
    .order('created_at', { ascending: false });

  console.log('\n=== cards (encrypted credentials table) ===');
  console.log('Total rows:', cards ? cards.length : 0, e2 ? 'ERROR: ' + e2.message : '');
  if (cards) cards.forEach((c, i) => console.log(i+1, c.wallet_address.slice(0,10)+'...', '|', c.card_type, '|', c.status));

  const { data: profiles } = await sb
    .from('wallet_profiles')
    .select('wallet_address, created_at')
    .order('created_at', { ascending: false });
  console.log('\n=== wallet_profiles ===');
  console.log('Total users:', profiles ? profiles.length : 0);
}
main().catch(console.error);
