'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FileText,
  Plus,
  Loader2,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  Globe,
  Clock,
  Save,
  Search,
} from 'lucide-react';

export interface CMSPageItem {
  id?: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PAGES: CMSPageItem[] = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    content: `# Terms of Service

Last Updated: September 2026

Welcome to **CryptoWallet**. By creating, importing, or using a wallet within this application, you agree to comply with and be bound by the following Terms of Service.

---

### 1. Non-Custodial Architecture
CryptoWallet is a non-custodial cryptocurrency wallet application. 
- You retain sole ownership and responsibility for your private keys, seed phrases, and funds.
- We do not store, hold, or have access to your private keys or recovery mnemonics.
- If you lose your recovery phrase, your funds cannot be recovered by CryptoWallet staff.

### 2. User Responsibilities
- Keep your 12-word BIP39 recovery phrase backed up in a secure, offline location.
- Verify recipient addresses and network details carefully prior to submitting transactions.
- Transactions broadcasted to blockchain networks (Ethereum, TRON, BSC, Solana, Bitcoin) are irreversible.

### 3. Acceptable Use
You agree not to use CryptoWallet for unlawful activities, including money laundering, fraud, or unauthorized financial transactions.

---

### 4. Limitation of Liability
CryptoWallet is provided "as is" without warranty of any kind. We are not liable for losses caused by lost keys, blockchain network congestion, smart contract vulnerabilities, or user error.

For inquiries or support, please contact our support desk through the Help & Support section in the app.`,
    is_published: true,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    content: `# Privacy Policy

Last Updated: September 2026

Your privacy is paramount. This Privacy Policy details how **CryptoWallet** protects your information.

---

### 1. Zero Personal Data Tracking
CryptoWallet is built on privacy-first architecture:
- We do **not** log, track, or sell your personal browsing habits, location, or transaction history.
- Your wallet private keys and recovery seed phrases remain encrypted strictly on your local device.

### 2. Information We Process
- **Public Wallet Addresses**: Used solely to query public blockchain nodes for balances and transaction history.
- **Account Profiles**: Basic preferences (display currency, theme preference, optional wallet name) stored in encrypted database tables to customize your experience.
- **Customer Support Logs**: Information you voluntarily provide when contacting support.

---

### 3. Third-Party RPC Providers
To interact with blockchains, the mobile app communicates with public blockchain nodes and RPC endpoints. These endpoints process standard blockchain queries to fetch on-chain state.

### 4. Data Security
Local app data is protected by system-level encryption (SecureStore / Keychain) and user-configured PIN authentication.`,
    is_published: true,
  },
  {
    slug: 'about',
    title: 'About CryptoWallet',
    content: `# About CryptoWallet

**CryptoWallet** is a state-of-the-art, non-custodial Web3 financial platform designed for multi-chain digital asset management, gasless transactions, and seamless decentralized finance.

---

### Key Capabilities
- **Multi-Chain Support**: Manage Ethereum, TRON (TRC-20), Binance Smart Chain, Solana, and Bitcoin assets in one unified interface.
- **GasFree TRON Transfers**: Transfer USDT on TRON without holding native TRX for gas fees.
- **Integrated Virtual & Physical Cards**: Convert crypto to spendable card balance globally.
- **Decentralized Escrow & P2P**: Trade assets securely through automated escrow contracts.
- **Institutional-Grade Security**: OS-level secure storage encryption with local PIN verification.

CryptoWallet Version 2.0.48`,
    is_published: true,
  },
];

export default function CMSPage() {
  const [pages, setPages] = useState<CMSPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editor modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CMSPageItem | null>(null);
  const [formData, setFormData] = useState<CMSPageItem>({
    slug: '',
    title: '',
    content: '',
    is_published: true,
  });

  // Preview modal state
  const [previewPage, setPreviewPage] = useState<CMSPageItem | null>(null);

  useEffect(() => {
    fetchCMSPages();
  }, []);

  async function fetchCMSPages() {
    setLoading(true);
    setToastMessage(null);
    try {
      // 1. Try fetching from cms_pages table
      const { data: dbPages, error: dbError } = await supabase
        .from('cms_pages')
        .select('*')
        .order('title', { ascending: true });

      if (!dbError && dbPages && dbPages.length > 0) {
        setPages(dbPages);
        setLoading(false);
        return;
      }

      // 2. Fallback to admin_settings table key 'cms_pages_data'
      const { data: settingsData, error: settingsError } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'cms_pages_data')
        .maybeSingle();

      if (!settingsError && settingsData?.value) {
        const val = settingsData.value;
        const list: CMSPageItem[] = typeof val === 'object' ? Object.values(val) : [];
        if (list.length > 0) {
          setPages(list);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to default initial pages
      setPages(DEFAULT_PAGES);
    } catch (err: any) {
      console.warn('CMS fetch error, using default pages:', err);
      setPages(DEFAULT_PAGES);
    } finally {
      setLoading(false);
    }
  }

  async function syncToAdminSettings(updatedPages: CMSPageItem[]) {
    try {
      const map: Record<string, CMSPageItem> = {};
      updatedPages.forEach(p => {
        map[p.slug] = p;
      });
      await supabase
        .from('admin_settings')
        .upsert({ key: 'cms_pages_data', value: map }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Failed to sync to admin_settings:', e);
    }
  }

  const handleOpenCreate = () => {
    setEditingPage(null);
    setFormData({
      slug: '',
      title: '',
      content: '',
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (page: CMSPageItem) => {
    setEditingPage(page);
    setFormData({ ...page });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.slug.trim() || !formData.title.trim() || !formData.content.trim()) {
      setToastMessage({ type: 'error', text: 'Slug, Title, and Content are required.' });
      return;
    }

    const cleanSlug = formData.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const nowIso = new Date().toISOString();
    const updatedItem: CMSPageItem = {
      ...formData,
      slug: cleanSlug,
      title: formData.title.trim(),
      updated_at: nowIso,
    };

    setSaving(true);
    setToastMessage(null);

    try {
      // 1. Try upsert to cms_pages table
      const { error: dbError } = await supabase
        .from('cms_pages')
        .upsert(updatedItem, { onConflict: 'slug' });

      if (dbError) {
        console.warn('cms_pages table upsert skipped:', dbError.message);
      }

      // 2. Update local state
      let nextPages: CMSPageItem[] = [];
      const existingIdx = pages.findIndex(p => p.slug === cleanSlug || (editingPage && p.slug === editingPage.slug));
      if (existingIdx >= 0) {
        nextPages = [...pages];
        nextPages[existingIdx] = updatedItem;
      } else {
        nextPages = [updatedItem, ...pages];
      }

      setPages(nextPages);

      // 3. Sync to admin_settings table for guaranteed mobile access
      await syncToAdminSettings(nextPages);

      setToastMessage({ type: 'success', text: `Page "${updatedItem.title}" saved successfully!` });
      setIsModalOpen(false);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: 'Failed to save page: ' + (err.message || err) });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (page: CMSPageItem) => {
    const nextStatus = !page.is_published;
    const nowIso = new Date().toISOString();
    const updatedItem: CMSPageItem = { ...page, is_published: nextStatus, updated_at: nowIso };

    try {
      // 1. Update cms_pages table if available
      await supabase.from('cms_pages').update({ is_published: nextStatus, updated_at: nowIso }).eq('slug', page.slug).catch(() => {});

      // 2. Update local state
      const nextPages = pages.map(p => (p.slug === page.slug ? updatedItem : p));
      setPages(nextPages);

      // 3. Sync to admin_settings
      await syncToAdminSettings(nextPages);

      setToastMessage({
        type: 'success',
        text: `Page "${page.title}" is now ${nextStatus ? 'PUBLISHED' : 'DRAFT'}.`,
      });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: 'Failed to update status: ' + err.message });
    }
  };

  const handleDelete = async (slugToDelete: string) => {
    if (!confirm(`Are you sure you want to delete page with slug "${slugToDelete}"?`)) return;

    try {
      await supabase.from('cms_pages').delete().eq('slug', slugToDelete).catch(() => {});

      const nextPages = pages.filter(p => p.slug !== slugToDelete);
      setPages(nextPages);
      await syncToAdminSettings(nextPages);

      setToastMessage({ type: 'success', text: `Page "${slugToDelete}" deleted.` });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: 'Failed to delete page: ' + err.message });
    }
  };

  const filteredPages = pages.filter(
    p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const publishedCount = pages.filter(p => p.is_published).length;
  const draftCount = pages.length - publishedCount;

  return (
    <div className="space-y-6 pb-12">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card-bg)] p-6 border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--accent-yellow)] border-2 border-[var(--border-color)] text-black">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display uppercase tracking-tight text-[var(--foreground)]">
              CMS & Legal Content Management
            </h1>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Manage mobile app legal documents, Terms of Service, Privacy Policy & Info pages dynamically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCMSPages}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--card-bg)] border-2 border-[var(--border-color)] text-[var(--foreground)] text-xs font-bold font-display uppercase shadow-[2px_2px_0px_0px_var(--border-color)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-yellow)] text-black border-2 border-[var(--border-color)] text-xs font-bold font-display uppercase shadow-[2px_2px_0px_0px_var(--border-color)] hover:opacity-90 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Page</span>
          </button>
        </div>
      </div>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between p-4 border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)] ${
            toastMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            {toastMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-black dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── OVERVIEW STATS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card-bg)] p-5 border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider font-display">Total Pages</span>
            <FileText className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div className="text-2xl font-black font-display mt-2">{pages.length}</div>
        </div>

        <div className="bg-[var(--card-bg)] p-5 border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider font-display">Published</span>
            <Globe className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-display mt-2 text-emerald-600">{publishedCount}</div>
        </div>

        <div className="bg-[var(--card-bg)] p-5 border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider font-display">Drafts</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-display mt-2 text-amber-600">{draftCount}</div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER ─── */}
      <div className="bg-[var(--card-bg)] p-4 border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)] flex items-center gap-3">
        <Search className="h-5 w-5 text-gray-400 ml-2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search CMS pages by title or slug (e.g. terms, privacy)..."
          className="w-full bg-transparent text-sm font-medium focus:outline-none"
        />
      </div>

      {/* ─── CMS PAGES TABLE ─── */}
      <div className="bg-[var(--card-bg)] border-3 border-[var(--border-color)] shadow-[4px_4px_0px_0px_var(--border-color)] overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-yellow)]" />
            <p className="text-sm font-bold font-display uppercase tracking-wider">Loading CMS Pages...</p>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="h-10 w-10 text-gray-400 mx-auto opacity-50" />
            <p className="text-sm font-bold text-gray-500 uppercase font-display">No CMS pages found</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[var(--accent-yellow)] text-black border-2 border-[var(--border-color)] text-xs font-bold uppercase font-display"
            >
              Create First Page
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--surface-low)] border-b-3 border-[var(--border-color)] uppercase font-display text-xs tracking-wider">
                  <th className="p-4 border-r-2 border-[var(--border-color)]">Page Details</th>
                  <th className="p-4 border-r-2 border-[var(--border-color)]">Slug (API Key)</th>
                  <th className="p-4 border-r-2 border-[var(--border-color)]">Status</th>
                  <th className="p-4 border-r-2 border-[var(--border-color)]">Last Updated</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[var(--border-color)]">
                {filteredPages.map(page => (
                  <tr key={page.slug} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4 border-r-2 border-[var(--border-color)] font-medium">
                      <div className="font-bold text-base">{page.title}</div>
                      <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                        {page.content.replace(/[#*`_]/g, '').slice(0, 80)}...
                      </div>
                    </td>
                    <td className="p-4 border-r-2 border-[var(--border-color)] font-mono text-xs">
                      <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-bold rounded">
                        /{page.slug}
                      </span>
                    </td>
                    <td className="p-4 border-r-2 border-[var(--border-color)]">
                      <button
                        onClick={() => handleTogglePublished(page)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase font-display border-2 border-[var(--border-color)] shadow-[2px_2px_0px_0px_var(--border-color)] transition-all cursor-pointer ${
                          page.is_published
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500'
                        }`}
                      >
                        {page.is_published ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        <span>{page.is_published ? 'Published' : 'Draft'}</span>
                      </button>
                    </td>
                    <td className="p-4 border-r-2 border-[var(--border-color)] text-xs font-mono text-gray-500">
                      {page.updated_at ? new Date(page.updated_at).toLocaleString() : 'Just now'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewPage(page)}
                          title="Preview Page"
                          className="p-2 bg-blue-500/10 text-blue-600 border border-blue-500 hover:bg-blue-500/20 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(page)}
                          title="Edit Page"
                          className="p-2 bg-amber-500/10 text-amber-600 border border-amber-500 hover:bg-amber-500/20 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(page.slug)}
                          title="Delete Page"
                          className="p-2 bg-red-500/10 text-red-600 border border-red-500 hover:bg-red-500/20 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── CREATE / EDIT MODAL ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[var(--card-bg)] border-3 border-[var(--border-color)] shadow-[8px_8px_0px_0px_var(--border-color)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 bg-[var(--accent-yellow)] text-black border-b-3 border-[var(--border-color)]">
              <div className="flex items-center gap-2 font-bold font-display uppercase tracking-wider">
                <FileText className="h-5 w-5" />
                <span>{editingPage ? `Edit Page: /${editingPage.slug}` : 'Create New CMS Page'}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-black/10 text-black cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase font-display mb-1 text-[var(--foreground)]">
                    Page Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Terms of Service"
                    required
                    className="w-full p-2.5 bg-[var(--surface-low)] border-2 border-[var(--border-color)] text-sm font-medium focus:outline-none focus:border-[var(--accent-yellow)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase font-display mb-1 text-[var(--foreground)]">
                    Page Slug (API Key) *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    placeholder="e.g. terms, privacy, about"
                    required
                    disabled={!!editingPage}
                    className="w-full p-2.5 bg-[var(--surface-low)] border-2 border-[var(--border-color)] text-sm font-mono font-medium focus:outline-none focus:border-[var(--accent-yellow)] disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase font-display mb-1 text-[var(--foreground)]">
                  Page Content (Markdown / Text) *
                </label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter full page content in Markdown or Plain Text..."
                  rows={14}
                  required
                  className="w-full p-3 bg-[var(--surface-low)] border-2 border-[var(--border-color)] text-sm font-mono focus:outline-none focus:border-[var(--accent-yellow)] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t-2 border-[var(--border-color)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={e => setFormData({ ...formData, is_published: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent-yellow)] cursor-pointer"
                  />
                  <span className="text-xs font-bold uppercase font-display">Publish Immediately to Mobile App</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-xs font-bold uppercase font-display border-2 border-[var(--border-color)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-[var(--accent-yellow)] text-black text-xs font-bold uppercase font-display border-2 border-[var(--border-color)] shadow-[2px_2px_0px_0px_var(--border-color)] hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{saving ? 'Saving...' : 'Save & Deploy'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PREVIEW MODAL ─── */}
      {previewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[var(--card-bg)] border-3 border-[var(--border-color)] shadow-[8px_8px_0px_0px_var(--border-color)] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 bg-[var(--surface-low)] border-b-3 border-[var(--border-color)]">
              <div className="flex items-center gap-2 font-bold font-display uppercase">
                <Eye className="h-5 w-5 text-[var(--accent-blue)]" />
                <span>Mobile Preview: {previewPage.title}</span>
              </div>
              <button onClick={() => setPreviewPage(null)} className="p-1 hover:bg-black/10 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 font-sans leading-relaxed text-sm">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[var(--border-color)] text-xs text-gray-400">
                <span>Slug: <strong className="font-mono">/{previewPage.slug}</strong></span>
                <span>Status: <strong className={previewPage.is_published ? 'text-emerald-500' : 'text-amber-500'}>{previewPage.is_published ? 'Published' : 'Draft'}</strong></span>
              </div>

              <div className="prose dark:prose-invert max-w-none text-xs whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 border border-gray-300 dark:border-gray-700 rounded">
                {previewPage.content}
              </div>
            </div>

            <div className="p-4 bg-[var(--surface-low)] border-t-3 border-[var(--border-color)] flex justify-end">
              <button
                onClick={() => setPreviewPage(null)}
                className="px-4 py-2 bg-[var(--accent-yellow)] text-black text-xs font-bold uppercase font-display border-2 border-[var(--border-color)]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
