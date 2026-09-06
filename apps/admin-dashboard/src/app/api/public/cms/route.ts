import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hxmacphgbpedazdvgdnz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // 1. Try querying cms_pages table
    const { data: dbPages, error: dbError } = await supabase
      .from('cms_pages')
      .select('id, slug, title, is_published, updated_at')
      .eq('is_published', true)
      .order('title', { ascending: true });

    if (!dbError && dbPages && dbPages.length > 0) {
      return NextResponse.json({ success: true, data: dbPages });
    }

    // 2. Fallback to admin_settings table key 'cms_pages_data'
    const { data: settingsData } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'cms_pages_data')
      .maybeSingle();

    if (settingsData?.value) {
      const pageMap = settingsData.value;
      const list = Object.values(pageMap)
        .filter((p: any) => p && p.is_published !== false)
        .map((p: any) => ({
          id: p.id || p.slug,
          slug: p.slug,
          title: p.title,
          is_published: true,
          updated_at: p.updated_at,
        }));
      return NextResponse.json({ success: true, data: list });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to list published CMS pages: ' + (err?.message || err) },
      { status: 500 }
    );
  }
}
