import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, status, notes } = body;

    if (!walletAddress || !status) {
      return NextResponse.json({ error: 'walletAddress and status are required' }, { status: 400 });
    }

    const normalizedAddr = walletAddress.trim().toLowerCase();

    if (status === 'verified') {
      // 1. Fetch KYC record from Supabase
      const { data: kycData, error: kycError } = await supabase
        .from('kyc')
        .select('*')
        .eq('wallet_address', normalizedAddr)
        .maybeSingle();

      if (kycError || !kycData) {
        return NextResponse.json({ error: 'KYC record not found for this wallet' }, { status: 404 });
      }

      const codegoCardholderId = kycData.codego_cardholder_id;
      if (!codegoCardholderId) {
        return NextResponse.json({
          error: 'User has not started Sandbox KYC verification yet. Please generate the Sandbox KYC Link first.'
        }, { status: 400 });
      }

      // 2. Fetch live status from Codego Sandbox
      console.log(`[Admin KYC Verify Action] Fetching Codego user status for ${codegoCardholderId}`);
      const res = await fetch(`${CODEGO_API_URL}/users/${codegoCardholderId}`, {
        headers: codegoHeaders,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Admin KYC Verify Action] Codego fetch failed:`, res.status, errText);
        return NextResponse.json({
          error: `User not found in CodeGo Sandbox or CodeGo API failed (HTTP ${res.status}).`
        }, { status: 400 });
      }

      const userData = await res.json();
      const appStatus = userData.applicationStatus || 'needsVerification';

      if (appStatus !== 'approved') {
        return NextResponse.json({
          error: `CodeGo Sandbox KYC is not completed/approved yet (current status: ${appStatus.toUpperCase()}). Please open the Sandbox KYC simulator link and complete verification first.`
        }, { status: 400 });
      }
    }

    // 3. Update status using Supabase RPC function (admin_update_kyc)
    console.log(`[Admin KYC Action] Updating KYC status to ${status} for ${normalizedAddr}`);
    const { error: updateError } = await supabase.rpc('admin_update_kyc', {
      p_wallet: normalizedAddr,
      p_status: status,
      p_notes: notes || null,
    });

    if (updateError) {
      console.error(`[Admin KYC Action] admin_update_kyc failed:`, updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin KYC Action] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
