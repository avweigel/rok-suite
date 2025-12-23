'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowLeft, BookOpen } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { GuideSidebar } from './GuideSidebar';
import { getTheme } from '@/lib/guide/theme';

interface GuideLayoutProps {
  children: React.ReactNode;
}

export function GuideLayout({ children }: GuideLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = getTheme();

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f1535]/80 backdrop-blur-xl border-b border-white/5">
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
              className="flex items-center gap-2 text-sm text-[#a0aec0] hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <span className="text-[#718096]">/</span>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9f7aea] to-[#4318ff] flex items-center justify-center shadow-lg shadow-[#9f7aea]/25">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-semibold">Guide</h1>
            </div>
          </div>

          <UserMenu />
        </div>
      </header>

      <div className="relative flex">
        {/* Sidebar - Desktop */}
        <aside
          className={`hidden lg:block w-64 shrink-0 ${theme.sidebar} border-r border-white/5 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto`}
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
              className={`fixed left-0 top-[57px] bottom-0 w-64 ${theme.bgSecondary} border-r border-white/5 z-50 overflow-y-auto lg:hidden`}
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
