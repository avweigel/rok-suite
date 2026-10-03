'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Calendar,
  Swords,
  Home,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
  Map,
  BarChart3,
  Calculator,
  Scale,
  ScrollText,
  Trophy,
  ClipboardList,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { FEATURES } from '@/lib/feature-flags';
import { KvkCountdownBanner } from './KvkCountdownBanner';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SignInButton } from './SignInButton';
import { useTranslations } from 'next-intl';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
  badgeKey?: string;
  badgeColor?: string;
  hoverColor?: string;
  hoverBg?: string;
  activeColor?: string;
  activeBg?: string;
}

interface NavSection {
  titleKey?: string;
  titleColor?: string;
  items: NavItem[];
}

interface AppSidebarProps {
  children: React.ReactNode;
}

export function AppSidebar({ children }: AppSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const t = useTranslations('nav');
  const t2 = useTranslations('common');

  const navSections: NavSection[] = [
    {
      // Kingdom section (no title, top level)
      items: [
        { labelKey: 'home', href: '/', icon: <Home size={20} />, hoverColor: 'group-hover:text-violet-400', hoverBg: 'hover:bg-violet-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-[#4318ff] to-[#7c3aed]' },
        { labelKey: 'calendar', href: '/calendar', icon: <Calendar size={20} />, hoverColor: 'group-hover:text-rose-500', hoverBg: 'hover:bg-rose-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-rose-500 to-pink-500' },
        { labelKey: 'allianceCalculator', href: '/alliance-calculator', icon: <Calculator size={20} />, hoverColor: 'group-hover:text-amber-500', hoverBg: 'hover:bg-amber-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-amber-500 to-orange-500' },
        { labelKey: 'fineCalculator', href: '/fine-calculator', icon: <Scale size={20} />, hoverColor: 'group-hover:text-amber-400', hoverBg: 'hover:bg-amber-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500' },
        { labelKey: 'rokMail', href: '/rok-mail', icon: <ScrollText size={20} />, hoverColor: 'group-hover:text-pink-500', hoverBg: 'hover:bg-pink-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-pink-500 to-fuchsia-500' },
        ...(FEATURES.dkp
          ? [{ labelKey: 'dkp', href: '/dkp', icon: <Trophy size={20} />, hoverColor: 'group-hover:text-yellow-500', hoverBg: 'hover:bg-yellow-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-yellow-500 to-amber-500' }]
          : []),
        { labelKey: 'alliances', href: '/alliances', icon: <Users size={20} />, hoverColor: 'group-hover:text-sky-400', hoverBg: 'hover:bg-sky-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-sky-500 to-blue-500' },
        { labelKey: 'scanUpload', href: '/upload', icon: <Upload size={20} />, hoverColor: 'group-hover:text-cyan-400', hoverBg: 'hover:bg-cyan-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-cyan-500 to-sky-500' },
        { labelKey: 'migration', href: '/migration', icon: <ClipboardList size={20} />, hoverColor: 'group-hover:text-orange-500', hoverBg: 'hover:bg-orange-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-orange-500 to-rose-500' },
        { labelKey: 'aooPlanner', href: '/aoo-strategy', icon: <Swords size={20} />, hoverColor: 'group-hover:text-emerald-500', hoverBg: 'hover:bg-emerald-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
        { labelKey: 'mge', href: '/mge', icon: <Shield size={20} />, hoverColor: 'group-hover:text-amber-500', hoverBg: 'hover:bg-amber-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500' },
        { labelKey: 'kingdomStats', href: '/kingdom/kingdom-stats', icon: <BarChart3 size={20} />, hoverColor: 'group-hover:text-green-500', hoverBg: 'hover:bg-green-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-green-500 to-emerald-500' },
        { labelKey: 'kvkMap', href: '/kvk-map', icon: <Map size={20} />, hoverColor: 'group-hover:text-orange-500', hoverBg: 'hover:bg-orange-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-orange-500 to-red-500' },
        { labelKey: 'applyLeader', href: '/apply', icon: <UserPlus size={20} />, hoverColor: 'group-hover:text-violet-400', hoverBg: 'hover:bg-violet-500/10', activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-violet-500 to-purple-500' },
      ],
    },
  ];

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    // Special case: /guide/alliance should not highlight /guide
    if (href === '/guide' && pathname.startsWith('/guide/alliance')) return false;
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <>
      {/* Logo — links to home */}
      <Link href="/" className={`flex items-center gap-3 px-4 py-5 border-b border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4318ff] to-[#9f7aea] flex items-center justify-center shadow-lg shadow-[#4318ff]/25 flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-[var(--foreground)] truncate">{t('siteTitle')}</h1>
            <p className="text-[10px] text-[var(--text-muted)] truncate">{t('siteSubtitle')}</p>
          </div>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-4' : ''}>
            {/* Section title */}
            {section.titleKey && !isCollapsed && (
              <div className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${section.titleColor || 'text-[var(--text-muted)]'}`}>
                {t(section.titleKey)}
              </div>
            )}
            {section.titleKey && isCollapsed && (
              <div className="h-px mx-3 my-2 bg-[var(--border)]" />
            )}

            {/* Section items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                      active
                        ? `${item.activeBg || 'bg-[#4318ff]'} ${item.activeColor || 'text-white'} shadow-lg`
                        : `text-[var(--text-secondary)] ${item.hoverBg || 'hover:bg-[var(--background-secondary)]'}`
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? t(item.labelKey) : undefined}
                  >
                    <span className={`flex-shrink-0 ${active ? (item.activeColor || 'text-white') : `text-[var(--text-muted)] ${item.hoverColor || 'group-hover:text-[var(--foreground)]'}`}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className={`flex-1 truncate ${!active && item.hoverColor ? item.hoverColor : ''}`}>{t(item.labelKey)}</span>
                        {item.badgeKey && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${item.badgeColor}`}>
                            {t(item.badgeKey)}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className={`px-3 py-4 border-t border-[var(--border)] space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className="text-xs text-[var(--text-muted)]">Account</span>
          )}
          <SignInButton collapsed={isCollapsed} menuPlacement="up" />
        </div>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className="text-xs text-[var(--text-muted)]">{t2('language')}</span>
          )}
          <LanguageSwitcher collapsed={isCollapsed} />
        </div>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className="text-xs text-[var(--text-muted)]">{t2('theme')}</span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-[var(--background-card)] border-r border-[var(--border)] transition-all duration-300 z-40 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[var(--background-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-colors shadow-sm"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--background-card)] border-b border-[var(--border)] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors"
          >
            <Menu size={20} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4318ff] to-[#9f7aea] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[var(--foreground)]">{t('siteTitle')}</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <SignInButton collapsed />
          <LanguageSwitcher collapsed dropdownDown />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen w-64 bg-[var(--background-card)] border-r border-[var(--border)] z-50 transform transition-transform duration-300 flex flex-col ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors"
        >
          <X size={20} />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        } pt-14 lg:pt-0 h-screen overflow-y-auto`}
      >
        <KvkCountdownBanner />
        {children}
      </main>
    </div>
  );
}
