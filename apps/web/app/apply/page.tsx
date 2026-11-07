'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield, ArrowLeft, Inbox, Send, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LeaderApplicationForm } from '@/components/apply/LeaderApplicationForm';
import { LeaderApplicationsAdmin } from '@/components/apply/LeaderApplicationsAdmin';
import { LeadBoard } from '@/components/apply/LeadBoard';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignInButton } from '@/components/SignInButton';
import { useAuthRole, meetsRole } from '@/lib/auth-role';
import { AuthGate } from '@/components/AuthGate';

type Tab = 'submit' | 'review' | 'board';

export default function ApplyPage() {
  return (
    <AuthGate require="power" title="Submit lead info">
      <ApplyPageInner />
    </AuthGate>
  );
}

function ApplyPageInner() {
  const t = useTranslations('apply');
  const { role } = useAuthRole();
  // Signed in only (any role). Review access is granted to both admin and officer.
  const isAdmin = meetsRole(role, ['admin', 'officer']);
  const [tab, setTab] = useState<Tab>(isAdmin ? 'review' : 'submit');

  const showReview = isAdmin && tab === 'review';
  const showBoard = isAdmin && tab === 'board';
  const containerMax = showReview || showBoard ? 'max-w-5xl' : 'max-w-2xl';

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className={`${containerMax} mx-auto px-4 py-3 flex items-center justify-between gap-2`}>
          <Link
            href="/"
            className="flex items-center gap-2 -ml-2 px-2 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] rounded-md hover:bg-[var(--background-secondary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('back')}</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher dropdownDown />
            {/* The account menu: role and Sign out */}
            <div className="opacity-70 hover:opacity-100 transition-opacity">
              <SignInButton />
            </div>
          </div>
        </div>
      </header>

      <main className={`${containerMax} mx-auto px-4 py-6 sm:py-10`}>
        {/* Hero — submit view only; admins reviewing don't need the recruitment pitch */}
        {!showReview && (
          <section className="mb-6 sm:mb-8 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#4318ff] to-[#9f7aea] shadow-lg shadow-[#4318ff]/25 mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--foreground)] tracking-tight mb-2">
              {t('title')}
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              {t('subtitle')}
            </p>
          </section>
        )}

        {/* Admin tabs — only visible when signed in as admin */}
        {isAdmin && (
          <div className="mb-6 flex justify-center">
            <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background-card)] p-1">
              <TabButton
                active={tab === 'review'}
                onClick={() => setTab('review')}
                icon={<Inbox className="w-4 h-4" />}
                label={t('tabs.review')}
              />
              <TabButton
                active={tab === 'board'}
                onClick={() => setTab('board')}
                icon={<Trophy className="w-4 h-4" />}
                label={t('tabs.board')}
              />
              <TabButton
                active={tab === 'submit'}
                onClick={() => setTab('submit')}
                icon={<Send className="w-4 h-4" />}
                label={t('tabs.submit')}
              />
            </div>
          </div>
        )}

        {showBoard ? <LeadBoard /> : showReview ? <LeaderApplicationsAdmin /> : <LeaderApplicationForm />}

        {!showReview && (
          <footer className="mt-10 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--text-muted)]">{t('footer')}</p>
          </footer>
        )}
      </main>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-gradient-to-r from-[#4318ff] to-[#7c3aed] text-white shadow-lg shadow-[#4318ff]/20'
          : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
