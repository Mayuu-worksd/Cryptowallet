/**
 * /api/cards/migrate-mock/route.ts
 *
 * POST: Migrates a single mock-card user to a real KripiCard.
 *
 * Called by the mobile app when a user has cardCreated=true but no codego_card_id.
 * Issues a real KripiCard for them, saves the card_id back to vcc_cards,
 * and returns the real card credentials so the app can update its local state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider, ProviderLogger } from '@/lib/providers';

export async function POST(req: NextRequest) {
  const provider = getCardProvider();

  try {
    const { walletAddress, nameOnCard } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const addr = walletAddress.toLowerCase();
    ProviderLogger.info(provider.name, 'migrate-mock', `Migrating mock card for ${addr}`);

    // 1. Check if already migrated
    const { data: existing } = await supabase
      .from('vcc_cards')
      .select('id, codego_card_id, card_status, card_holder_name, balance')
      .eq('wallet_address', addr)
      .maybeSingle();

    if (existing?.codego_card_id) {
      // Already has a real KripiCard — just return it
      const liveCard = await provider.getCard(existing.codego_card_id).catch(() => null);
      return NextResponse.json({
        success: true,
        alreadyMigrated: true,
        cardId: existing.codego_card_id,
        card: liveCard ? {
          number: liveCard.number,
          cvv: liveCard.cvv,
          expiry: liveCard.expiryMmYy,
          last4: liveCard.last4,
          holderName: liveCard.holderName,
          status: liveCard.status,
          balance: existing.balance,
        } : null,
      });
    }

    // 2. Get or build KYC data
    let { data: kycData } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', addr)
      .maybeSingle();

    const holderName = (nameOnCard || kycData?.full_name || 'CARD HOLDER').toUpperCase();

    if (!kycData || kycData.status !== 'verified') {
      kycData = {
        wallet_address: addr,
        full_name: holderName,
        email: `${addr.slice(0, 10)}@kripicard.user`,
        status: 'verified',
        nationality: 'US',
        address: '123 Fintech Way',
        dob: '1990-01-01',
      };
      await supabase.from('kyc').upsert(kycData, { onConflict: 'wallet_address' }).catch(() => {});
    }

    // 3. Issue real KripiCard
    const cardResult = await provider.createCard(
      { cardholderId: addr, type: 'virtual', nameOnCard: holderName, walletAddress },
      kycData,
    );

    const currentBalance = existing?.balance ?? 0;

    // 4. Update vcc_cards row with real KripiCard id
    if (existing) {
      await supabase
        .from('vcc_cards')
        .update({
          codego_card_id: cardResult.providerCardId,
          codego_status: cardResult.providerStatus,
          card_last4: cardResult.last4,
          expiry_mm_yy: cardResult.expiryMmYy,
          card_holder_name: holderName,
          card_status: cardResult.status,
          provider_name: provider.name,
          provider_response: cardResult.raw || {},
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('vcc_cards').insert({
        wallet_address: addr,
        codego_card_id: cardResult.providerCardId,
        codego_status: cardResult.providerStatus,
        card_last4: cardResult.last4,
        expiry_mm_yy: cardResult.expiryMmYy,
        card_holder_name: holderName,
        card_status: cardResult.status,
        card_network: 'Visa',
        card_variant: 'classic',
        balance: 0,
        provider_name: provider.name,
        provider_response: cardResult.raw || {},
        physical_shipping_status: 'not_requested',
        kyc_verified: true,
        compliance_status: 'compliant',
      });
    }

    // 5. Also upsert provider_cards table
    await supabase.from('provider_cards').upsert({
      wallet_address: addr,
      provider_name: provider.name,
      provider_card_id: cardResult.providerCardId,
      card_holder_name: holderName,
      card_last4: cardResult.last4,
      expiry_mm_yy: cardResult.expiryMmYy,
      card_type: 'virtual',
      card_variant: 'classic',
      status: cardResult.status,
      provider_status: cardResult.providerStatus,
      balance: currentBalance,
      is_mock: false,
      provider_response: cardResult.raw || {},
    }, { onConflict: 'provider_card_id' }).catch(() => {});

    ProviderLogger.info(provider.name, 'migrate-mock', `Migration complete for ${addr} → card_id: ${cardResult.providerCardId}`);

    return NextResponse.json({
      success: true,
      alreadyMigrated: false,
      cardId: cardResult.providerCardId,
      card: {
        number: cardResult.number,
        cvv: cardResult.cvv,
        expiry: cardResult.expiryMmYy,
        last4: cardResult.last4,
        holderName: cardResult.holderName,
        status: cardResult.status,
        balance: currentBalance,
      },
    });

  } catch (error: any) {
    ProviderLogger.error(provider.name, 'migrate-mock', error.message, error);
    return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 });
  }
}
