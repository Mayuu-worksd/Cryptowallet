/**
 * /api/cards/route.ts
 *
 * Generic provider-independent route for card creation and listing.
 * Delegates to CardProvider.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';
import type { CardResult } from '@/lib/providers';

function _toCardData(r: CardResult) {
  return {
    id:          r.providerCardId,
    status:      r.providerStatus || r.status,
    maskedPan:   `•••• •••• •••• ${r.last4}`,
    last4:       r.last4,
    expiryMonth: r.expiryMmYy?.split('/')[0],
    expiryYear:  '20' + (r.expiryMmYy?.split('/')[1] || '28'),
    number:      r.number,
    cvv:         r.cvv,
    limit:       { amount: 0 },
  };
}

async function _upsertVccCard(
  supabase: any,
  existingVccCard: any,
  walletAddress: string,
  cardResult: CardResult,
  type: string,
  variant?: string,
) {
  const row = {
    codego_card_id: cardResult.providerCardId,
    codego_status:  cardResult.providerStatus || cardResult.status,
    card_last4:     cardResult.last4,
    expiry_mm_yy:   cardResult.expiryMmYy,
    card_holder_name: cardResult.holderName,
    card_status:    cardResult.status,
    is_physical:    type === 'physical',
  };

  if (existingVccCard) {
    await supabase.from('vcc_cards').update(row).eq('id', existingVccCard.id);
  } else {
    await supabase.from('vcc_cards').insert({
      wallet_address:           walletAddress.toLowerCase(),
      card_network:             'Visa',
      card_variant:             variant || 'classic',
      balance:                  0,
      physical_shipping_status: type === 'physical' ? 'processing' : 'not_requested',
      kyc_verified:             true,
      compliance_status:        'compliant',
      ...row,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, type, variant, nameOnCard } = body;

    if (!walletAddress || !type) {
      return NextResponse.json({ error: 'walletAddress and type are required' }, { status: 400 });
    }

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

    const provider = getCardProvider();

    const { data: existingVccCard } = await supabase
      .from('vcc_cards')
      .select('id, codego_card_id, card_status, card_last4, expiry_mm_yy')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (existingVccCard?.codego_card_id) {
      const liveCard = await provider.getCard(existingVccCard.codego_card_id);
      if (liveCard) {
        return NextResponse.json({
          message: 'Card already synced to Provider',
          cardData: liveCard.raw || liveCard,
          alreadyExists: true,
        });
      }
      return NextResponse.json({
        message: 'Card already synced to Provider (cached)',
        cardData: {
          id:          existingVccCard.codego_card_id,
          status:      existingVccCard.card_status || 'active',
          maskedPan:   `•••• •••• •••• ${existingVccCard.card_last4 || '0000'}`,
          last4:       existingVccCard.card_last4 || '0000',
          expiryMonth: existingVccCard.expiry_mm_yy ? existingVccCard.expiry_mm_yy.split('/')[0] : '12',
          expiryYear:  existingVccCard.expiry_mm_yy ? '20' + existingVccCard.expiry_mm_yy.split('/')[1] : '2028',
        },
        alreadyExists: true,
      });
    }

    let providerCardholderId: string | null = kycData.codego_cardholder_id || null;

    if (!providerCardholderId) {
      const nameParts = (kycData.full_name || 'Unknown User').trim().split(' ');
      const result = await provider.registerCardholder({
        walletAddress,
        email:           kycData.email || '',
        firstName:       nameParts[0] || 'Unknown',
        lastName:        nameParts.slice(1).join(' ') || 'User',
        birthDate:       kycData.dob,
        phone:           kycData.phone || '10000000000',
        phoneCountryCode: '1',
        ipAddress:       req.headers.get('x-forwarded-for') || '127.0.0.1',
        address: {
          line1:       kycData.address || '123 Main St',
          city:        'Unknown',
          postalCode:  '00000',
          countryCode: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
        },
        nationalId:     '123456789',
        countryOfIssue: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
      });

      if (!result.cardholderId) {
        const holderName = (nameOnCard || kycData.full_name || 'CARD HOLDER').toUpperCase();
        const cardResult = await provider.createCard(
          { cardholderId: '', type: type as 'virtual' | 'physical', variant, nameOnCard: holderName, walletAddress },
          kycData,
        );
        await _upsertVccCard(supabase, existingVccCard, walletAddress, cardResult, type, variant);
        return NextResponse.json({
          message:        'Card issued successfully (local fallback)',
          cardData:       cardResult.raw || cardResult,
          internalStatus: cardResult.status,
          isMock:         cardResult.isMock,
        });
      }

      providerCardholderId = result.cardholderId;
      await supabase.from('kyc').update({ codego_cardholder_id: providerCardholderId }).eq('wallet_address', walletAddress.toLowerCase());
    }

    const holderStatus = await provider.getCardholder(providerCardholderId);
    const holderName   = (nameOnCard || kycData.full_name || 'CARD HOLDER').toUpperCase();

    if (!holderStatus.found || holderStatus.status !== 'approved') {
      const cardResult = await provider.createCard(
        { cardholderId: providerCardholderId, type: type as 'virtual' | 'physical', variant, nameOnCard: holderName, walletAddress },
        kycData,
      );
      await _upsertVccCard(supabase, existingVccCard, walletAddress, cardResult, type, variant);
      return NextResponse.json({
        message:        'Card issued successfully (admin verified)',
        cardData:       cardResult.raw || _toCardData(cardResult),
        internalStatus: cardResult.status,
        isMock:         cardResult.isMock,
      });
    }

    const existingCards = await provider.listCards(providerCardholderId);
    const targetType    = type === 'physical' ? 'physical' : 'virtual';
    const matchingCard  = existingCards.find((c: any) =>
      ((c.raw as any)?.type || 'virtual').toLowerCase() === targetType,
    );

    if (matchingCard) {
      await _upsertVccCard(supabase, existingVccCard, walletAddress, matchingCard, type, variant);
      return NextResponse.json({
        message:        'Existing card retrieved and synced successfully',
        cardData:       matchingCard.raw || _toCardData(matchingCard),
        internalStatus: matchingCard.status,
        alreadyExists:  true,
      });
    }

    const billingAddress = type === 'physical' ? {
      line1:      kycData.address || '123 Main St',
      city:       'Unknown',
      postalCode: '00000',
      country:    kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
    } : undefined;

    const cardResult = await provider.createCard(
      { cardholderId: providerCardholderId, type: type as 'virtual' | 'physical', variant, nameOnCard: holderName, billingAddress, walletAddress },
      kycData,
    );
    await _upsertVccCard(supabase, existingVccCard, walletAddress, cardResult, type, variant);

    return NextResponse.json({
      message:        cardResult.isMock ? 'Card issued successfully (local fallback)' : 'Card issued successfully',
      cardData:       cardResult.raw    || _toCardData(cardResult),
      internalStatus: cardResult.status,
      isMock:         cardResult.isMock,
    });

  } catch (error: any) {
    console.error('[/api/cards] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress query param required' }, { status: 400 });
  }

  const provider = getCardProvider();

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

  let providerCards: any[] = [];
  if (kycData?.codego_cardholder_id) {
    providerCards = await provider.listCards(kycData.codego_cardholder_id);
  }

  return NextResponse.json({ cards: cards || [], providerCards });
}
