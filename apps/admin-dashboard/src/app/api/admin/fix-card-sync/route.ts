import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Same XOR cipher used in supabaseService.ts on the mobile app
function xorEncrypt(text: string, key: string): string {
  const k = key.toLowerCase().replace('0x', '');
  return Array.from(text).map((ch, i) => {
    const kByte = parseInt(k[i % k.length] ?? '0', 16);
    return ch.charCodeAt(0) ^ kByte;
  }).map(n => n.toString(16).padStart(2, '0')).join('');
}

// POST /api/admin/fix-card-sync
// Fixes the mismatch between vcc_cards (source of truth) and cards (encrypted credentials).
// Deletes the stale cards row and regenerates a fresh number that ends in the correct last4.
export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }

    const addr = walletAddress.toLowerCase();

    // 1. vcc_cards is the source of truth
    const { data: vcc, error: vccError } = await supabase
      .from('vcc_cards')
      .select('*')
      .eq('wallet_address', addr)
      .maybeSingle();

    if (vccError || !vcc) {
      return NextResponse.json({ error: 'No vcc_cards record found for this wallet' }, { status: 404 });
    }

    const last4 = vcc.card_last4 || '0000';
    const expiryMmYy = vcc.expiry_mm_yy || '12/28';
    const [expiryMonth, expiryYear] = expiryMmYy.split('/');
    const holderName = vcc.card_holder_name || 'CARD HOLDER';
    const isMastercard = (vcc.card_network || '').toLowerCase() === 'mastercard';

    // 2. Generate a fresh 16-digit number ending in the exact last4 from vcc_cards
    const prefix = isMastercard ? 5 : 4;
    const middle = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10));
    const allDigits = [prefix, ...middle, ...last4.split('').map(Number)];
    const cardNumber = [
      allDigits.slice(0, 4).join(''),
      allDigits.slice(4, 8).join(''),
      allDigits.slice(8, 12).join(''),
      last4,
    ].join(' ');

    // 3. Random CVV
    const cvv = String(Math.floor(100 + Math.random() * 900));

    // 4. XOR-encrypt with wallet address as key
    const encNumber = xorEncrypt(cardNumber.replace(/\s/g, ''), addr);
    const encCvv    = xorEncrypt(cvv, addr);

    // 5. Wipe stale cards row and insert fresh one matching vcc_cards
    await supabase.from('cards').delete().eq('wallet_address', addr);

    const { error: insertError } = await supabase.from('cards').insert({
      wallet_address:        addr,
      card_last4:            last4,
      card_number_encrypted: encNumber,
      cvv_encrypted:         encCvv,
      expiry_month:          expiryMonth || '12',
      expiry_year:           expiryYear  || '28',
      card_type:             vcc.card_variant || 'classic',
      balance:               vcc.balance || 0,
      status:                vcc.card_status === 'frozen' ? 'frozen' : 'active',
      holder_name:           holderName,
      design:                'dark',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Card credentials resynced — last4: ${last4}, expiry: ${expiryMmYy}, holder: ${holderName}`,
      last4,
      expiryMmYy,
      holderName,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
