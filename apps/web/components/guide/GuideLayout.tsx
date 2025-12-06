'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowLeft } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { GuideSidebar } from './GuideSidebar';
import { getTheme } from '@/lib/guide/theme';

interface GuideLayoutProps {
  children: React.ReactNode;
}

export function GuideLayout({ children }: GuideLayoutProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('aoo-theme', newMode ? 'dark' : 'light');
  };

  const theme = getTheme(darkMode);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-200`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`lg:hidden p-2 rounded-lg ${theme.button}`}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Back to home */}
            <Link
              href="/"
              className={`flex items-center gap-2 text-sm ${theme.textMuted} hover:${theme.text} transition-colors`}
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <span className={`${theme.textMuted}`}>/</span>
            <h1 className="font-semibold">Guide</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside
          className={`hidden lg:block w-64 shrink-0 ${theme.sidebar} border-r ${theme.border} sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto`}
        >
          <div className="p-4">
            <GuideSidebar theme={theme} />
          </div>
        </aside>

        {/* Sidebar - Mobile overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className={`fixed left-0 top-[57px] bottom-0 w-64 ${theme.bgSecondary} border-r ${theme.border} z-50 overflow-y-auto lg:hidden`}
            >
              <div className="p-4">
                <GuideSidebar theme={theme} />
              </div>
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
