import { supabase } from './supabaseClient';

export interface CMSPageData {
  id?: string;
  slug: string;
  title: string;
  content: string;
  updated_at?: string;
}

export const cmsService = {
  /**
   * Fetches published CMS page content by slug.
   * Uses backend API endpoint with Supabase direct fallback.
   */
  async getPage(slug: string): Promise<{ data?: CMSPageData; error?: string }> {
    const cleanSlug = slug.toLowerCase().trim();
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // 1. Primary: Try Backend API
    try {
      const response = await fetch(`${apiUrl}/api/public/cms/${cleanSlug}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.success && json?.data) {
          return { data: json.data };
        }
      }
    } catch (_apiErr) {
      console.warn(`[cmsService] API fetch failed for '${cleanSlug}', trying Supabase fallback...`);
    }

    // 2. Fallback 1: Query Supabase cms_pages table directly
    try {
      const { data: dbPage, error: dbError } = await supabase
        .from('cms_pages')
        .select('id, slug, title, content, updated_at')
        .eq('slug', cleanSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (!dbError && dbPage) {
        return { data: dbPage };
      }
    } catch (_dbErr) {}

    // 3. Fallback 2: Query Supabase admin_settings table (key: cms_pages_data)
    try {
      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'cms_pages_data')
        .maybeSingle();

      if (settingsData?.value) {
        const map = settingsData.value;
        const page = map[cleanSlug];
        if (page && page.is_published !== false) {
          return {
            data: {
              id: page.id || cleanSlug,
              slug: page.slug || cleanSlug,
              title: page.title || 'Legal Document',
              content: page.content || '',
              updated_at: page.updated_at,
            },
          };
        }
      }
    } catch (_settingsErr) {}

    return { error: `Unable to load legal content for '${cleanSlug}'. Please check your network connection.` };
  },
};
