import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, status, notes } = body;

    if (!walletAddress || !status) {
      return NextResponse.json({ error: 'walletAddress and status are required' }, { status: 400 });
    }

    const normalizedAddr = walletAddress.trim().toLowerCase();

    if (status === 'verified') {
      // Admin has full authority to verify — no Codego sandbox check required.
      // The card creation flow (/api/codego/cards) already handles mock card issuance
      // for users whose Codego sandbox status is not 'approved'.
      // We just update Supabase directly.
      const { data: kycData, error: kycError } = await supabase
        .from('kyc')
        .select('id')
        .eq('wallet_address', normalizedAddr)
        .maybeSingle();

      if (kycError || !kycData) {
        return NextResponse.json({ error: 'KYC record not found for this wallet' }, { status: 404 });
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
