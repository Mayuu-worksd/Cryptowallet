const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hxmacphgbpedazdvgdnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEwMjI2MCwiZXhwIjoyMDkyNjc4MjYwfQ.vZ1uvQ8R_zu8ZjVZtyRSiGKMaACTmc6T0WgHx2_LE80'
);

async function main() {
  // All wallet profiles
  const { data: profiles } = await sb.from('wallet_profiles').select('wallet_address, wallet_name, created_at').order('created_at', { ascending: false });
  const { data: vcc } = await sb.from('vcc_cards').select('wallet_address');
  const { data: cards } = await sb.from('cards').select('wallet_address, card_last4, created_at');
  const { data: kyc } = await sb.from('kyc').select('wallet_address, status, full_name');

  const vccSet = new Set((vcc || []).map(c => c.wallet_address));
  const cardsMap = Object.fromEntries((cards || []).map(c => [c.wallet_address, c]));
  const kycMap = Object.fromEntries((kyc || []).map(k => [k.wallet_address, k]));

  console.log('=== ALL USERS STATUS ===\n');
  (profiles || []).forEach((p, i) => {
    const hasVcc = vccSet.has(p.wallet_address);
    const hasCard = !!cardsMap[p.wallet_address];
    const kycRec = kycMap[p.wallet_address];
    console.log(
      i+1,
      p.wallet_address.slice(0,10)+'...',
      '| name:', (p.wallet_name || '').padEnd(15),
      '| kyc:', (kycRec?.status || 'none').padEnd(12),
      '| vcc_cards:', hasVcc ? 'YES' : 'NO ',
      '| cards tbl:', hasCard ? 'YES ('+cardsMap[p.wallet_address].card_last4+')' : 'NO'
    );
  });

  // Orphaned: in cards but not vcc_cards
  const orphaned = (cards || []).filter(c => !vccSet.has(c.wallet_address));
  console.log('\n=== ORPHANED (cards table but no vcc_cards) ===');
  orphaned.forEach(c => console.log(' ', c.wallet_address, '| last4:', c.card_last4, '| created:', c.created_at));
}
main().catch(console.error);
