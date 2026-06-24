import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

export async function POST(request: Request) {
  try {
    const { cardId, action, trackingNumber } = await request.json();

    if (!cardId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let newStatus = action;

    // Fetch the card first to get the wallet address
    const { data: cardData, error: cardError } = await supabase
      .from('vcc_cards')
      .select('wallet_address, card_variant, card_holder_name, codego_card_id')
      .eq('id', cardId)
      .maybeSingle();

    if (cardError || !cardData) {
      return NextResponse.json({ error: 'Card request not found' }, { status: 404 });
    }

    if (newStatus === 'shipped' || newStatus === 'approved') {
      const { data: kycData, error: kycError } = await supabase
        .from('kyc')
        .select('*')
        .eq('wallet_address', cardData.wallet_address.toLowerCase())
        .maybeSingle();

      if (kycError || !kycData) {
        return NextResponse.json({ error: 'KYC record not found for this user.' }, { status: 400 });
      }

      if (!kycData.codego_cardholder_id) {
        return NextResponse.json({
          error: 'User has not started Sandbox KYC verification yet. Please complete Sandbox KYC first.'
        }, { status: 400 });
      }

      // Fetch live status from Codego Sandbox
      console.log(`[Admin Physical Card Action] Fetching Codego user status for ${kycData.codego_cardholder_id}`);
      const res = await fetch(`${CODEGO_API_URL}/users/${kycData.codego_cardholder_id}`, {
        headers: codegoHeaders,
      });

      if (!res.ok) {
        return NextResponse.json({
          error: `User not found in CodeGo Sandbox or CodeGo API failed (HTTP ${res.status}).`
        }, { status: 400 });
      }

      const userData = await res.json();
      const appStatus = userData.applicationStatus || 'needsVerification';

      if (appStatus !== 'approved') {
        return NextResponse.json({
          error: `CodeGo Sandbox KYC is not completed/approved yet (current status: ${appStatus.toUpperCase()}). The user must complete the verification in the Sandbox simulator first.`
        }, { status: 400 });
      }
    }

    const updateData = { 
      physical_shipping_status: newStatus,
      ...(trackingNumber !== undefined && { tracking_number: trackingNumber })
    };

    const { data, error } = await supabase
      .from('vcc_cards')
      .update(updateData)
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating vcc_cards:`, error);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    // Sync to Codego if status is shipped and not already synced
    if (newStatus === 'shipped' && !data.codego_card_id) {
      try {
        const origin = new URL(request.url).origin;
        const codegoRes = await fetch(`${origin}/api/codego/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: data.wallet_address,
            type: 'physical',
            variant: data.card_variant,
            nameOnCard: data.card_holder_name,
          }),
        });
        
        const codegoResult = await codegoRes.json();
        if (!codegoRes.ok) {
          console.warn('[Physical Card Action] Codego physical card sync warning:', codegoResult.error || codegoResult);
        } else {
          console.log('[Physical Card Action] Codego physical card issued successfully:', codegoResult);
        }
      } catch (err) {
        console.error('[Physical Card Action] Error syncing physical card to Codego:', err);
      }
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error processing physical card action:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
