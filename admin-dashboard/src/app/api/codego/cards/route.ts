import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Correct auth header
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// Maps Codego card status to internal vcc_cards status
function mapCodegoStatus(codegoStatus: string): 'pending' | 'active' | 'frozen' | 'blocked' {
  switch (codegoStatus?.toLowerCase()) {
    case 'active':
    case 'activated':
      return 'active';
    case 'locked':
    case 'frozen':
      return 'frozen';
    case 'canceled':
    case 'cancelled':
    case 'blocked':
      return 'blocked';
    default:
      return 'pending';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, type, variant, nameOnCard } = body;

    if (!walletAddress || !type) {
      return NextResponse.json({ error: 'walletAddress and type are required' }, { status: 400 });
    }

    // 1. Get KYC record
    const { data: kycData, error: kycError } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (kycError || !kycData) {
      return NextResponse.json({ error: 'User KYC not found. KYC is required.' }, { status: 400 });
    }

    if (kycData.status !== 'verified') {
      return NextResponse.json({ error: 'KYC is not verified' }, { status: 400 });
    }

    // 2. Check for existing vcc_cards record — prevent duplicates
    const { data: existingVccCard } = await supabase
      .from('vcc_cards')
      .select('id, codego_card_id, card_status')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    // If already synced to Codego, don't create another
    if (existingVccCard?.codego_card_id) {
      return NextResponse.json({
        message: 'Card already synced to Codego',
        cardId: existingVccCard.id,
        codegoCardId: existingVccCard.codego_card_id,
        alreadyExists: true,
      });
    }

    // 3. Ensure Codego cardholder exists — auto-create via /applications if needed
    let codegoCardholderId: string | null = kycData.codego_cardholder_id || null;

    if (!codegoCardholderId) {
      const nameParts = (kycData.full_name || 'Unknown User').trim().split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'User';
      const externalUserId = `cw_${walletAddress.toLowerCase().replace('0x', '').slice(0, 16)}`;

      const appRes = await fetch(`${CODEGO_API_URL}/applications`, {
        method: 'POST',
        headers: codegoHeaders,
        body: JSON.stringify({
          walletAddress: walletAddress.toLowerCase(),
          email: kycData.email || `${externalUserId}@example.com`,
          firstName,
          lastName,
          birthDate: kycData.dob || '1990-01-01',
          phoneNumber: (kycData.phone || '10000000000').replace(/\D/g, ''),
          phoneCountryCode: '1',
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          address: {
            line1: kycData.address || '123 Main St',
            city: 'Unknown',
            postalCode: '00000',
            countryCode: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
          },
          nationalId: '123456789', // Sandbox requirement
          countryOfIssue: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
          key: process.env.CODEGO_API_KEY || CODEGO_API_KEY,
        }),
      });

      if (!appRes.ok) {
        const errData = await appRes.json().catch(() => ({}));
        console.warn('[Codego cards] /applications failed:', appRes.status, errData);
        // Non-fatal: continue as admin-managed card (no Codego ID yet)
        // Card is created in vcc_cards without codego_card_id
        return NextResponse.json({
          error: 'Codego application failed — card cannot be issued until Codego onboarding is complete',
          details: errData,
          httpStatus: appRes.status,
          note: 'Sandbox requires KYC token (sumsubShareToken/personaShareToken). This will work in production.',
        }, { status: 422 });
      }

      const appData = await appRes.json();
      codegoCardholderId = appData.id || appData.userId || externalUserId;

      // Save cardholder mapping
      await supabase
        .from('kyc')
        .update({ codego_cardholder_id: codegoCardholderId })
        .eq('wallet_address', walletAddress.toLowerCase());
    }

    // 4. Map variant to Codego limits
    const limitMap: Record<string, number> = {
      platinum: 100000_00, // $100,000 in cents
      gold: 50000_00,
      classic: 5000_00,
      travel: 30000_00,
    };
    const limitAmount = limitMap[variant?.toLowerCase()] ?? 5000_00;

    const codegoCardPayload: any = {
      type: type === 'physical' ? 'physical' : 'virtual',
      limit: { amount: limitAmount, frequency: 'monthly' },
      configuration: {
        displayName: (nameOnCard || kycData.full_name || 'Crypto Wallet Card').toUpperCase(),
        productId: '1',
      },
    };

    if (type === 'physical') {
      codegoCardPayload.billing = {
        line1: kycData.address || '123 Main St',
        city: 'Unknown',
        postalCode: '00000',
        country: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
      };
    }

    // 5. FIX: POST /users/{id}/cards — correct card creation endpoint
    const cardRes = await fetch(`${CODEGO_API_URL}/users/${codegoCardholderId}/cards`, {
      method: 'POST',
      headers: codegoHeaders,
      body: JSON.stringify(codegoCardPayload),
    });

    if (!cardRes.ok) {
      const errData = await cardRes.json().catch(() => ({}));
      console.error('[Codego cards] Card creation failed:', cardRes.status, errData);
      return NextResponse.json({
        error: 'Failed to issue Codego card',
        details: errData,
        httpStatus: cardRes.status,
      }, { status: cardRes.status });
    }

    const cardData = await cardRes.json();

    // 6. Map Codego card fields to our schema
    const expiryMmYy = (cardData.expiryMonth && cardData.expiryYear)
      ? `${String(cardData.expiryMonth).padStart(2, '0')}/${String(cardData.expiryYear).slice(-2)}`
      : '12/28';

    const last4 = (cardData.maskedPan || cardData.last4 || '0000').replace(/\D/g, '').slice(-4) || '0000';
    const holderName = (nameOnCard || kycData.full_name || 'CARD HOLDER').toUpperCase();
    const internalStatus = mapCodegoStatus(cardData.status);

    // 7. Upsert vcc_cards — update if record exists, insert if not
    if (existingVccCard) {
      const { error: updateErr } = await supabase
        .from('vcc_cards')
        .update({
          codego_card_id: cardData.id,
          codego_status: cardData.status || 'active',
          card_last4: last4,
          expiry_mm_yy: expiryMmYy,
          card_holder_name: holderName,
          card_status: internalStatus,
          is_physical: type === 'physical',
        })
        .eq('id', existingVccCard.id);

      if (updateErr) {
        console.error('[Codego cards] vcc_cards update failed:', updateErr.message);
      }
    } else {
      const { error: insertErr } = await supabase
        .from('vcc_cards')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          card_last4: last4,
          expiry_mm_yy: expiryMmYy,
          card_holder_name: holderName,
          card_network: 'Visa',
          card_status: internalStatus,
          card_variant: variant || 'classic',
          codego_card_id: cardData.id,
          codego_status: cardData.status || 'active',
          balance: 0,
          is_physical: type === 'physical',
          physical_shipping_status: type === 'physical' ? 'processing' : 'not_requested',
          kyc_verified: true,
          compliance_status: 'compliant',
        });

      if (insertErr) {
        console.error('[Codego cards] vcc_cards insert failed:', insertErr.message);
      }
    }

    return NextResponse.json({ message: 'Card issued successfully', cardData, internalStatus });
  } catch (error: any) {
    console.error('[Codego cards] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET — list cards for a wallet address
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress query param required' }, { status: 400 });
  }

  const { data: kycData } = await supabase
    .from('kyc')
    .select('codego_cardholder_id')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle();

  const { data: cards } = await supabase
    .from('vcc_cards')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });

  // If cardholder is mapped, also fetch live from Codego
  let codegoCards: any[] = [];
  if (kycData?.codego_cardholder_id) {
    const res = await fetch(`${CODEGO_API_URL}/users/${kycData.codego_cardholder_id}/cards`, {
      headers: codegoHeaders,
    });
    if (res.ok) {
      codegoCards = await res.json().catch(() => []);
    }
  }

  return NextResponse.json({ cards: cards || [], codegoCards });
}
