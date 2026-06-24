import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, type, variant, nameOnCard } = body;

    if (!walletAddress || !type) {
      return NextResponse.json({ error: 'walletAddress and type are required' }, { status: 400 });
    }

    // 1. Get KYC record to find codego_cardholder_id
    const { data: kycData, error: kycError } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (kycError || !kycData) {
      return NextResponse.json({ error: 'User KYC not found. KYC is required for a virtual card.' }, { status: 400 });
    }

    let codegoCardholderId = kycData.codego_cardholder_id;

    if (!codegoCardholderId) {
      // Auto-create Codego Cardholder for existing users
      const chResponse = await fetch(`${CODEGO_API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CODEGO_API_KEY}`
        },
        body: JSON.stringify({
          email: kycData.email,
          firstName: kycData.first_name || kycData.full_name?.split(' ')[0] || 'User',
          lastName: kycData.last_name || kycData.full_name?.split(' ').slice(1).join(' ') || 'Unknown',
          address: {
            line1: kycData.address || '123 Test St',
            city: kycData.city || 'Test City',
            postalCode: kycData.postal_code || '00000',
            country: kycData.country || 'US'
          },
          dateOfBirth: kycData.date_of_birth || '1990-01-01',
          phone: kycData.phone_number || '+10000000000'
        })
      });

      if (!chResponse.ok) {
        const errorData = await chResponse.json().catch(() => ({}));
        console.error('Codego auto-cardholder creation error:', errorData);
        return NextResponse.json({ error: 'Failed to auto-create Codego cardholder', details: errorData }, { status: chResponse.status });
      }

      const chData = await chResponse.json();
      codegoCardholderId = chData.id;

      // Update KYC record
      await supabase
        .from('kyc')
        .update({ codego_cardholder_id: codegoCardholderId })
        .eq('wallet_address', walletAddress.toLowerCase());
    }

    // 2. Map variant to limits
    const limitAmount = variant === 'premium' ? 1000000 : variant === 'gold' ? 5000000 : 50000;
    const limitFrequency = 'monthly';

    const codegoPayload: any = {
      type: type === 'physical' ? 'physical' : 'virtual',
      limit: {
        amount: limitAmount,
        frequency: limitFrequency
      },
      configuration: {
        displayName: nameOnCard || kycData.full_name || 'Crypto Wallet Card',
        productId: '1'
      }
    };

    if (type === 'physical') {
      codegoPayload.billing = {
        line1: kycData.address || '123 Test St',
        city: kycData.city || 'Test City',
        postalCode: kycData.postal_code || '00000',
        country: kycData.country || 'US'
      };
    }

    // 3. Create Card in Codego
    const response = await fetch(`${CODEGO_API_URL}/users/${codegoCardholderId}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CODEGO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(codegoPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego card issue error:', errorData);
      return NextResponse.json({ error: 'Failed to issue Codego card', details: errorData }, { status: response.status });
    }

    const cardData = await response.json();

    // 4. Update vcc_cards in Supabase
    // We update the existing VCC Card record if one was created in pending state, or create a new one.
    const { data: existingCard } = await supabase
      .from('vcc_cards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    const expiryMmYy = cardData.expiryMonth && cardData.expiryYear
      ? `${String(cardData.expiryMonth).padStart(2,'0')}/${String(cardData.expiryYear).slice(-2)}`
      : '12/28';
    const maskedPan = cardData.maskedPan || cardData.last4
      ? `•••• •••• •••• ${(cardData.maskedPan || cardData.last4 || '').slice(-4)}`
      : `•••• •••• •••• ${Math.floor(1000 + Math.random() * 9000)}`;
    const holderName = (nameOnCard || kycData.full_name || 'CARD HOLDER').toUpperCase();

    if (existingCard) {
      await supabase
        .from('vcc_cards')
        .update({
          codego_card_id: cardData.id,
          codego_status: cardData.status,
          card_last4: (cardData.maskedPan || cardData.last4 || '').slice(-4),
          expiry_mm_yy: expiryMmYy,
          card_holder_name: holderName,
          card_status: 'active',
        })
        .eq('id', existingCard.id);
    } else {
      await supabase
        .from('vcc_cards')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          card_last4: (cardData.maskedPan || cardData.last4 || '').slice(-4),
          expiry_mm_yy: expiryMmYy,
          card_holder_name: holderName,
          card_network: 'Visa',
          card_status: 'active',
          card_variant: variant || 'standard',
          codego_card_id: cardData.id,
          codego_status: cardData.status,
          balance: 0,
        });
    }

    return NextResponse.json({ message: 'Card issued successfully', cardData });
  } catch (error: any) {
    console.error('Error issuing Codego card:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
