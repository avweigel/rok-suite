'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Clock, Map, Swords, ScrollText, ArrowRight, Lock } from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';
import { useUserRole } from '@/lib/supabase/use-guide';

const alliancePages = [
  {
    slug: 'guardians',
    title: 'Guardian Runs',
    description: 'Schedule, timers, and protocol for Holy Site guardian kills',
    icon: <Clock size={20} />,
    highlight: true,
  },
  {
    slug: 'territory',
    title: 'Territory Policy',
    description: 'Rules for farmers in our territory and zone control',
    icon: <Map size={20} />,
  },
  {
    slug: 'rallies',
    title: 'Rally Protocol',
    description: 'When and how to join rallies, troop requirements',
    icon: <Swords size={20} />,
  },
  {
    slug: 'rules',
    title: 'Alliance Rules',
    description: 'General policies, activity requirements, and expectations',
    icon: <ScrollText size={20} />,
  },
];

export default function AlliancePage() {
  const [darkMode, setDarkMode] = useState(true);
  const { role, isLeaderOrAdmin } = useUserRole();

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const theme = getTheme(darkMode);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
            <Shield size={24} className="text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold">Alliance</h1>
        </div>
        <p className={theme.textMuted}>
          How we do things in Angmar Nazgul Guards. Protocols, schedules, and policies
          specific to our alliance.
        </p>
      </div>

      {/* Leader notice */}
      {isLeaderOrAdmin && (
        <div className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-sm ${theme.textAccent}`}>
            <strong>Leader Access:</strong> You can edit alliance content on each page.
          </p>
        </div>
      )}

      {/* Alliance Pages */}
      <div className="grid gap-4">
        {alliancePages.map((page) => (
          <Link key={page.slug} href={`/guide/alliance/${page.slug}`}>
            <div
              className={`${theme.card} border rounded-lg p-5 transition-all hover:border-purple-500/50 cursor-pointer group ${
                page.highlight ? `${darkMode ? 'border-purple-500/30' : 'border-purple-200'}` : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    {page.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-purple-400 transition-colors">
                      {page.title}
                    </h3>
                    <p className={`text-sm ${theme.textMuted} mt-1`}>
                      {page.description}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className={`${theme.textMuted} group-hover:text-purple-400 transition-colors`}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Access Note */}
      <div className={`mt-8 p-4 rounded-lg ${theme.card} border`}>
        <div className="flex items-start gap-3">
          <Lock size={18} className={theme.textMuted} />
          <div>
            <p className={`text-sm ${theme.textMuted}`}>
              Alliance content can be edited by R4 (Officers) and R5 (Leaders).
              Contact alliance leadership if you notice outdated information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
