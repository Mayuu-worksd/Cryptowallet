import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hxmacphgbpedazdvgdnz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Helper to resolve client IP
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

// In-memory GeoIP cache to avoid repeated external lookups for same IP
const geoCache = new Map<string, { country: string; country_code: string; city: string }>();

async function resolveGeo(ip: string, req: NextRequest) {
  // 1. Check Vercel automatic edge headers
  const vercelCountry = req.headers.get('x-vercel-ip-country');
  const vercelCity = req.headers.get('x-vercel-ip-city');
  if (vercelCountry) {
    return {
      country: vercelCountry === 'IN' ? 'India' : vercelCountry === 'US' ? 'United States' : vercelCountry,
      country_code: vercelCountry,
      city: vercelCity ? decodeURIComponent(vercelCity) : 'Unknown',
    };
  }

  // 2. Private/localhost IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local Network', country_code: 'LO', city: 'Development' };
  }

  // 3. Check memory cache
  if (geoCache.has(ip)) {
    return geoCache.get(ip)!;
  }

  // 4. Fallback lookup via public IP API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        const geo = {
          country: data.country || 'Unknown',
          country_code: data.countryCode || 'XX',
          city: data.city || 'Unknown',
        };
        geoCache.set(ip, geo);
        return geo;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return { country: 'Unknown', country_code: 'XX', city: 'Unknown' };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientIp = getClientIp(req);
    const geo = await resolveGeo(clientIp, req);

    const sessionId = (body.session_id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim();
    const deviceId = (body.device_id || 'unknown_device').trim();
    const walletAddress = body.wallet_address ? body.wallet_address.toLowerCase().trim() : null;
    const userUid = body.user_uid ? Number(body.user_uid) : null;
    const platform = body.platform || 'android';
    const deviceModel = body.device_model || 'Mobile Device';
    const appVersion = body.app_version || '1.0.0';
    const screenName = body.screen_name || 'Home';
    const action = body.action || 'hit'; // 'hit' | 'heartbeat' | 'leave'
    const isOnline = action !== 'leave';

    // 1. Try checking existing active session
    const { data: existing } = await supabase
      .from('app_traffic_logs')
      .select('id, hit_count')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing) {
      // Update session heartbeat, screen, and hit count
      const newHitCount = action === 'hit' ? (existing.hit_count || 1) + 1 : existing.hit_count;
      await supabase
        .from('app_traffic_logs')
        .update({
          screen_name: screenName,
          hit_count: newHitCount,
          is_online: isOnline,
          last_heartbeat: new Date().toISOString(),
          wallet_address: walletAddress || undefined,
          user_uid: userUid || undefined,
        })
        .eq('id', existing.id);
    } else {
      // Insert new session log
      await supabase
        .from('app_traffic_logs')
        .insert({
          session_id: sessionId,
          device_id: deviceId,
          wallet_address: walletAddress,
          user_uid: userUid,
          ip_address: clientIp,
          country: geo.country,
          country_code: geo.country_code,
          city: geo.city,
          platform,
          device_model: deviceModel,
          app_version: appVersion,
          screen_name: screenName,
          hit_count: 1,
          is_online: isOnline,
          last_heartbeat: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      ip: clientIp,
      country: geo.country,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    // Two minutes threshold for "online"
    const onlineThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from('app_traffic_logs')
      .select('*')
      .order('last_heartbeat', { ascending: false })
      .limit(limit);

    if (error) {
      // Fallback: table not created yet in SQL editor
      return NextResponse.json({
        success: true,
        stats: { online_now: 0, total_hits: 0, total_sessions: 0, countries_count: 0 },
        countries: [],
        logs: [],
        notice: 'Table app_traffic_logs not created yet. Please run database/schemas/app_traffic_logs.sql in Supabase SQL editor.'
      });
    }

    // Process statistics
    const activeOnlineCount = (logs || []).filter(
      (l) => l.is_online && l.last_heartbeat >= onlineThreshold
    ).length;

    const totalHitsToday = (logs || []).reduce((acc, l) => acc + (l.hit_count || 1), 0);

    // Country distribution
    const countryMap: Record<string, { country: string; code: string; count: number }> = {};
    (logs || []).forEach((l) => {
      const code = l.country_code || 'XX';
      if (!countryMap[code]) {
        countryMap[code] = { country: l.country || 'Unknown', code, count: 0 };
      }
      countryMap[code].count += 1;
    });

    const countries = Object.values(countryMap).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      stats: {
        online_now: activeOnlineCount,
        total_hits: totalHitsToday,
        total_sessions: logs?.length || 0,
        countries_count: countries.length,
      },
      countries,
      logs: logs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
