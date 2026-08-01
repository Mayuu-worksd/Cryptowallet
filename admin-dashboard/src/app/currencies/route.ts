import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('fiat_currencies')
    .select('*')
    .order('code', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map backend rate column to exchange_rate for client compatibility
  const formatted = (data || []).map(c => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    exchange_rate: c.rate,
    rate: c.rate,
    is_enabled: c.is_enabled
  }));

  return NextResponse.json(formatted);
}
