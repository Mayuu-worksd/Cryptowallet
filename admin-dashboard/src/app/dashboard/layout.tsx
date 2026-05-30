'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Store,
  RefreshCw,
  ArrowLeftRight,
  BarChart3,
  LogOut,
  Shield,
  Menu,
  X,
  User,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  CreditCard,
  Landmark,
  Network,
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string | number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Collapsible sidebar state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Theme switcher state (persisted)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync theme and sidebar from localStorage on mount
  useEffect(() => {
    // 1. Sidebar preference
    const savedSidebar = localStorage.getItem('sidebar-collapsed');
    if (savedSidebar === 'true') {
      setSidebarCollapsed(true);
    }
    
    // 2. Theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Live admin clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out of the admin panel?')) {
      setLoggingOut(true);
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      } catch (e) {
        console.error('Logout failed:', e);
      } finally {
        setLoggingOut(false);
      }
    }
  };

  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebar-collapsed', String(newCollapsed));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const navigation: SidebarItem[] = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/dashboard/users', icon: Users },
    { name: 'KYC Reviews', href: '/dashboard/kyc', icon: ShieldCheck },
    { name: 'Merchant Hub', href: '/dashboard/merchants', icon: Store },
    { name: 'P2P & Escrow', href: '/dashboard/p2p', icon: RefreshCw },
    { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
    { name: 'Card Requests', href: '/dashboard/cards', icon: CreditCard },
    { name: 'Bank Accounts', href: '/dashboard/bank-accounts', icon: Landmark },
    { name: 'Networks', href: '/dashboard/networks', icon: Network },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-[var(--accent-yellow)] transition-colors duration-200">
      
      {/* ────────────────── DESKTOP SIDEBAR ────────────────── */}
      <aside className={`hidden lg:flex flex-col border-r-3 border-[var(--border-color)] bg-[var(--card-bg)] shrink-0 z-30 transition-all duration-300 overflow-hidden ${
        sidebarCollapsed ? 'w-0 border-r-0' : 'w-[280px]'
      }`}>
        {/* Logo Panel */}
        <div className="h-20 flex items-center justify-between px-6 border-b-3 border-[var(--border-color)] bg-[var(--accent-yellow)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded">
              <img src="/logo.png" alt="CryptoWallet" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-md font-bold tracking-tight text-white font-display uppercase">VAULT_ADMIN</h2>
              <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">
                V2.0.48
              </p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            title="Collapse Sidebar"
            className="p-1 border-2 border-[#1a1a1a] bg-white hover:bg-gray-100 text-[#1a1a1a] cursor-pointer"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Logout Button — top of nav */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-[var(--border-color)] bg-[var(--accent-red)] text-black text-xs font-bold font-display uppercase tracking-wider shadow-[2px_2px_0px_0px_var(--border-color)] hover:opacity-80 active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>{loggingOut ? 'Terminating...' : 'Terminate Node'}</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 border-2 border-transparent transition-all uppercase tracking-wider text-xs font-bold font-display ${
                  isActive
                    ? 'text-[var(--foreground)] bg-[var(--card-bg)] border-[var(--border-color)] shadow-[3px_3px_0px_0px_var(--border-color)] translate-x-[-2px] translate-y-[-2px]'
                    : 'text-[var(--foreground)] hover:bg-[var(--accent-yellow)]/20 hover:border-[var(--border-color)] hover:shadow-[2px_2px_0px_0px_var(--border-color)] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-[var(--foreground)]" />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer info panel */}
        <div className="p-4 border-t-3 border-[var(--border-color)] bg-[var(--background)]">
          <div className="flex items-center gap-3 p-3 border-2 border-[var(--border-color)] bg-[var(--card-bg)] shadow-[2px_2px_0px_0px_var(--border-color)]">
            <div className="h-9 w-9 border border-[var(--border-color)] bg-[var(--accent-blue)] flex items-center justify-center text-white">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--foreground)] truncate font-display">SUPER_ADMIN</p>
              <p className="text-[10px] text-gray-500 truncate font-semibold font-mono">Platform Operator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ────────────────── MOBILE SLIDEOUT DRAWER ────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative flex flex-col w-[280px] h-full bg-[var(--card-bg)] border-r-3 border-[var(--border-color)] shadow-2xl animate-slide-in-right z-50">
            {/* Header */}
            <div className="h-20 flex items-center justify-between px-6 border-b-3 border-[var(--border-color)] bg-[var(--accent-yellow)]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 overflow-hidden rounded">
                  <img src="/logo.png" alt="CryptoWallet" className="w-full h-full object-contain" />
                </div>
                <span className="text-sm font-bold text-white font-display">VAULT_ADMIN</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Logout Button — top of nav */}
            <div className="px-4 pt-4 pb-2">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-[var(--border-color)] bg-[var(--accent-red)] text-white text-xs font-bold font-display uppercase tracking-wider transition-all disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{loggingOut ? 'Terminating...' : 'Terminate Node'}</span>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 border-2 border-transparent transition-all uppercase tracking-wider text-xs font-bold font-display ${
                      isActive
                        ? 'text-[#1a1a1a] bg-[var(--accent-yellow)]/20 border-[var(--border-color)] shadow-[2px_2px_0px_0px_var(--border-color)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--background)]'
                    }`}
                  >
                    <item.icon className="h-5 w-5 text-[var(--foreground)]" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* ────────────────── MAIN CONTENT WRAPPER ────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Header Panel */}
        <header className="h-20 flex items-center justify-between px-4 md:px-8 border-b-3 border-[var(--border-color)] bg-[var(--card-bg)] sticky top-0 z-20 transition-colors duration-200">
          <div className="flex items-center gap-4">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 border-2 border-[var(--border-color)] bg-[var(--accent-yellow)] text-[#1a1a1a] hover:bg-[var(--border-color)] hover:text-[var(--accent-yellow)] transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--border-color)]"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 border-2 border-[var(--border-color)] bg-[var(--accent-yellow)] text-[#1a1a1a] font-bold text-xs uppercase tracking-wider font-display shadow-[2px_2px_0px_0px_var(--border-color)] hover:bg-[var(--border-color)] hover:text-[var(--accent-yellow)] transition-all cursor-pointer"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span>{sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}</span>
            </button>

            {/* Status Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 border-2 border-[var(--border-color)] bg-[var(--card-bg)] shadow-[2px_2px_0px_0px_var(--border-color)]">
              <span className="h-2.5 w-2.5 border border-[var(--border-color)] bg-[var(--accent-red)] animate-pulse" />
              <span className="text-[10px] font-bold text-[var(--foreground)] uppercase tracking-widest font-display">
                Mainnet Live Sync
              </span>
            </div>
          </div>

          {/* Quick Controls & Stats Panel */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              className="flex items-center gap-2 px-3.5 py-1.5 border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] font-bold text-xs uppercase tracking-wider font-display shadow-[2px_2px_0px_0px_var(--border-color)] hover:bg-[var(--accent-yellow)] hover:text-[#1a1a1a] transition-all cursor-pointer"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-4 w-4 text-[var(--accent-blue)]" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4 text-[var(--accent-yellow)]" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              )}
            </button>

            {/* Clock */}
            <div className="flex items-center gap-2 text-[var(--foreground)] border-r-2 border-[var(--border-color)] pr-4">
              <Clock className="h-4.5 w-4.5 text-[var(--accent-blue)]" />
              <span className="text-xs font-mono font-bold tracking-wider">{currentTime || '00:00:00'}</span>
            </div>

            {/* Supabase Link */}
            <a
              href="https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--accent-yellow)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_0px_var(--border-color)] text-[10px] font-bold tracking-wider uppercase font-display transition-all"
            >
              <span>Console</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-8 space-y-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
