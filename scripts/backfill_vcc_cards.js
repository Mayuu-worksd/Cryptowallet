/**
 * backfill_vcc_cards.js
 * One-time fix: users who have a `cards` row but no `vcc_cards` row
 * (created via Codego path before the upsert fix) won't show in admin.
 * This script backfills vcc_cards from the cards table.
 */
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hxmacphgbpedazdvgdnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEwMjI2MCwiZXhwIjoyMDkyNjc4MjYwfQ.vZ1uvQ8R_zu8ZjVZtyRSiGKMaACTmc6T0WgHx2_LE80'
);

async function main() {
  const { data: cards } = await sb.from('cards').select('*');
  const { data: vcc } = await sb.from('vcc_cards').select('wallet_address');
  const vccSet = new Set((vcc || []).map(c => c.wallet_address));

  const orphaned = (cards || []).filter(c => !vccSet.has(c.wallet_address));
  console.log('Orphaned cards rows (no vcc_cards):', orphaned.length);

  for (const card of orphaned) {
    const expiry = card.expiry_month && card.expiry_year
      ? `${card.expiry_month}/${card.expiry_year}`
      : '12/28';

    const { error } = await sb.from('vcc_cards').upsert({
      wallet_address:           card.wallet_address,
      card_last4:               card.card_last4 || '0000',
      card_holder_name:         card.holder_name || 'CARD HOLDER',
      expiry_mm_yy:             expiry,
      card_variant:             card.card_type || 'classic',
      card_network:             'Visa',
      card_status:              card.status === 'frozen' ? 'frozen' : 'active',
      balance:                  card.balance || 0,
      is_physical:              false,
      physical_shipping_status: 'not_requested',
      kyc_verified:             true,
      name_match:               true,
      compliance_status:        'compliant',
    }, { onConflict: 'wallet_address' });

    if (error) {
      console.log('FAILED:', card.wallet_address, error.message);
    } else {
      console.log('BACKFILLED:', card.wallet_address, '| last4:', card.card_last4, '| holder:', card.holder_name);
    }
  }

  console.log('\nDone. Refresh the admin Virtual Cards tab.');
}
main().catch(console.error);
