import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hxmacphgbpedazdvgdnz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ success: false, error: 'Slug parameter required' }, { status: 400 });
  }

  const cleanSlug = slug.toLowerCase().trim();

  try {
    // 1. Try querying cms_pages table first
    const { data: dbPage, error: dbError } = await supabase
      .from('cms_pages')
      .select('id, slug, title, content, is_published, created_at, updated_at')
      .eq('slug', cleanSlug)
      .eq('is_published', true)
      .maybeSingle();

    if (!dbError && dbPage) {
      return NextResponse.json({
        success: true,
        data: dbPage,
      });
    }

    // 2. Fallback to admin_settings table (key: 'cms_pages_data')
    const { data: settingsData } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'cms_pages_data')
      .maybeSingle();

    if (settingsData?.value) {
      const pageMap = settingsData.value;
      const page = pageMap[cleanSlug];
      if (page && page.is_published !== false) {
        return NextResponse.json({
          success: true,
          data: {
            id: page.id || cleanSlug,
            slug: page.slug || cleanSlug,
            title: page.title || 'Legal Document',
            content: page.content || '',
            is_published: true,
            created_at: page.created_at || new Date().toISOString(),
            updated_at: page.updated_at || new Date().toISOString(),
          },
        });
      }
    }

    return NextResponse.json(
      { success: false, error: `CMS page '${cleanSlug}' not found or not published` },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CMS content: ' + (err?.message || err) },
      { status: 500 }
    );
  }
}
