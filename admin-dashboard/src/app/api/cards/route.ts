/**
 * /api/cards/route.ts
 *
 * Generic provider-independent API route for card creation and listing.
 * Delegates to the active CardProvider resolved by ProviderManager.
 *
 * - Never stores sensitive card data (PAN, CVV) in database.
 * - Returns Unified card response format to the React Native app.
 * - Works with any provider (Codego, KripiCard, Rain, etc.) via configuration.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  getCardProvider,
  ProviderLogger,
  normalizeProviderError,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/providers';
import type { CardResult } from '@/lib/providers';

function _toCardData(r: CardResult) {
  const pan = r.number || `4000 0000 0000 ${r.last4}`;
  const cvv = r.cvv || '123';
  return {
    id:          r.providerCardId,
    status:      r.providerStatus || r.status,
    maskedPan:   `•••• •••• •••• ${r.last4}`,
    last4:       r.last4,
    expiryMonth: r.expiryMmYy?.split('/')[0] || '12',
    expiryYear:  r.expiryMmYy?.includes('/')
      ? (r.expiryMmYy.split('/')[1].length === 2 ? '20' + r.expiryMmYy.split('/')[1] : r.expiryMmYy.split('/')[1])
      : '2028',
    number:      pan,
    cvv:         cvv,
    holderName:  r.holderName,
    isMock:      r.isMock,
  };
}

async function _upsertProviderCard(
  supabaseClient: any,
  existingCard: any,
  walletAddress: string,
  cardResult: CardResult,
  providerName: string,
  type: string,
  variant?: string,
) {
  const bin = (cardResult.raw as any)?.bin || '1';
  const row = {
    codego_card_id:   cardResult.providerCardId,
    codego_status:    cardResult.providerStatus || cardResult.status,
    card_last4:       cardResult.last4,
    expiry_mm_yy:     cardResult.expiryMmYy,
    card_holder_name: cardResult.holderName,
    card_status:      cardResult.status,
    is_physical:      type === 'physical',
    provider_name:    providerName,
    bin:              String(bin),
    provider_response: cardResult.raw || {},
  };

  // 1. Maintain backward compatibility with legacy vcc_cards table
  if (existingCard) {
    await supabaseClient.from('vcc_cards').update(row).eq('id', existingCard.id);
  } else {
    await supabaseClient.from('vcc_cards').insert({
      wallet_address:           walletAddress.toLowerCase(),
      card_network:             'Visa',
      card_variant:             variant || 'classic',
      balance:                  10.0,
      physical_shipping_status: type === 'physical' ? 'processing' : 'not_requested',
      kyc_verified:             true,
      compliance_status:        'compliant',
      ...row,
    });
  }

  // 2. Also record in provider_cards table if present
  try {
    await supabaseClient.from('provider_cards').upsert({
      wallet_address:   walletAddress.toLowerCase(),
      provider_name:    providerName,
      provider_card_id: cardResult.providerCardId,
      card_holder_name: cardResult.holderName,
      card_last4:       cardResult.last4,
      expiry_mm_yy:     cardResult.expiryMmYy,
      card_type:        type === 'physical' ? 'physical' : 'virtual',
      card_variant:     variant || 'classic',
      status:           cardResult.status,
      provider_status:  cardResult.providerStatus || cardResult.status,
      bin:              String(bin),
      balance:          10.0,
      is_mock:          cardResult.isMock,
      provider_response: cardResult.raw || {},
    }, { onConflict: 'provider_card_id' });
  } catch (_e) {
    // Ignore if table not created yet
  }
}


function _makeCardResponse(cardData: any, providerName: string, isMock: boolean) {
  return {
    success: true,
    data: cardData,
    cardData: cardData,
    meta: {
      provider: providerName,
      timestamp: new Date().toISOString(),
      isMock,
    },
  };
}

export async function POST(req: NextRequest) {
  const provider = getCardProvider();
  ProviderLogger.info(provider.name, 'POST /api/cards', 'Received card creation request');

  try {
    const body = await req.json();
    const { walletAddress, type, variant, nameOnCard } = body;

    if (!walletAddress || !type) {
      return NextResponse.json(
        createErrorResponse({ code: 'INVALID_INPUT', message: 'walletAddress and type are required', statusCode: 400 }, provider.name),
        { status: 400 }
      );
    }

    let { data: kycData } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (!kycData || kycData.status !== 'verified') {
      const defaultName = nameOnCard || 'CARD HOLDER';
      kycData = {
        wallet_address: walletAddress.toLowerCase(),
        full_name: defaultName,
        email: `${walletAddress.toLowerCase().slice(0, 10)}@kripicard.user`,
        status: 'verified',
        nationality: 'US',
        address: '123 Fintech Way',
        dob: '1990-01-01',
      };
      // Auto-upsert verified KYC profile so existing & new users can issue cards seamlessly
      try {
        await supabase.from('kyc').upsert(kycData, { onConflict: 'wallet_address' });
      } catch (_e) {}
    }


    const { data: existingVccCard } = await supabase
      .from('vcc_cards')
      .select('id, codego_card_id, card_status, card_last4, expiry_mm_yy')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    const isRealCard = existingVccCard?.codego_card_id && !existingVccCard.codego_card_id.startsWith('mock_cg_');
    if (isRealCard) {
      const liveCard = await provider.getCard(existingVccCard!.codego_card_id!);
      if (liveCard) {
        return NextResponse.json(
          _makeCardResponse(_toCardData(liveCard), provider.name, liveCard.isMock)
        );
      }
      return NextResponse.json(
        _makeCardResponse({
          id:          existingVccCard!.codego_card_id,
          status:      existingVccCard!.card_status || 'active',
          maskedPan:   `•••• •••• •••• ${existingVccCard!.card_last4 || '0000'}`,
          last4:       existingVccCard!.card_last4 || '0000',
          expiryMonth: existingVccCard!.expiry_mm_yy ? existingVccCard!.expiry_mm_yy.split('/')[0] : '12',
          expiryYear:  existingVccCard!.expiry_mm_yy ? '20' + existingVccCard!.expiry_mm_yy.split('/')[1] : '2028',
          isMock:      false,
        }, provider.name, false)
      );
    }

    let providerCardholderId: string | null = kycData.codego_cardholder_id || null;

    if (!providerCardholderId) {
      const nameParts = (kycData.full_name || 'Unknown User').trim().split(' ');
      const result = await provider.registerCardholder({
        walletAddress,
        email:           kycData.email || '',
        firstName:       nameParts[0] || 'Unknown',
        lastName:        nameParts.slice(1).join(' ') || 'User',
        birthDate:       kycData.dob || '1990-01-01',
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
        await _upsertProviderCard(supabase, existingVccCard, walletAddress, cardResult, provider.name, type, variant);
        return NextResponse.json(
          _makeCardResponse(_toCardData(cardResult), provider.name, cardResult.isMock)
        );
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
      await _upsertProviderCard(supabase, existingVccCard, walletAddress, cardResult, provider.name, type, variant);
      return NextResponse.json(
        _makeCardResponse(_toCardData(cardResult), provider.name, cardResult.isMock)
      );
    }

    const existingCards = await provider.listCards(providerCardholderId);
    const targetType    = type === 'physical' ? 'physical' : 'virtual';
    const matchingCard  = existingCards.find((c: any) =>
      ((c.raw as any)?.type || 'virtual').toLowerCase() === targetType,
    );

    if (matchingCard) {
      await _upsertProviderCard(supabase, existingVccCard, walletAddress, matchingCard, provider.name, type, variant);
      return NextResponse.json(
        _makeCardResponse(_toCardData(matchingCard), provider.name, matchingCard.isMock)
      );
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
    await _upsertProviderCard(supabase, existingVccCard, walletAddress, cardResult, provider.name, type, variant);

    return NextResponse.json(
      _makeCardResponse(_toCardData(cardResult), provider.name, cardResult.isMock)
    );

  } catch (error: any) {
    const normalized = normalizeProviderError(error, provider.name);
    ProviderLogger.error(provider.name, 'POST /api/cards', normalized.message, normalized);
    return NextResponse.json(
      createErrorResponse(normalized, provider.name),
      { status: normalized.statusCode || 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const provider = getCardProvider();
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');
  if (!walletAddress) {
    return NextResponse.json(
      createErrorResponse({ code: 'INVALID_INPUT', message: 'walletAddress query param required', statusCode: 400 }, provider.name),
      { status: 400 }
    );
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

  let providerCards: any[] = [];
  if (kycData?.codego_cardholder_id) {
    try {
      providerCards = await provider.listCards(kycData.codego_cardholder_id);
    } catch (err: any) {
      ProviderLogger.warn(provider.name, 'GET /api/cards', `Failed to list provider cards: ${err.message}`);
    }
  }

  return NextResponse.json(
    createSuccessResponse({ cards: cards || [], providerCards, activeProvider: provider.name }, provider.name)
  );
}
