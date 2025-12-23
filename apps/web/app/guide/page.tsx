'use client';

import Link from 'next/link';
import { Calendar, Shield, Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';

export default function GuidePage() {
  const theme = getTheme();

  const sections = [
    {
      title: 'Events',
      description: 'Game event guides, strategies, and checklists for success',
      href: '/guide/events',
      icon: <Calendar size={24} />,
      color: 'emerald',
      items: ['Ark of Osiris', 'Mightiest Governor', 'Ceroli Crisis', 'and more...'],
    },
    {
      title: 'Alliance',
      description: 'How we do things - protocols, schedules, and policies',
      href: '/guide/alliance',
      icon: <Shield size={24} />,
      color: 'purple',
      items: ['Guardian Runs', 'Territory Policy', 'Rally Protocol', 'Alliance Rules'],
    },
    {
      title: 'Commander Strategy',
      description: 'Personalized commander progression and efficiency guides',
      href: '/guide/commanders',
      icon: <Sparkles size={24} />,
      color: 'amber',
      items: ['Choose your path', 'Screenshot analysis', 'KvK preparation', 'F2P & P2P guides'],
    },
  ];

  const colorClasses: Record<string, { border: string; text: string; bg: string }> = {
    emerald: {
      border: 'hover:border-[#01b574]/50',
      text: 'group-hover:text-[#01b574]',
      bg: 'bg-[#01b574]/10',
    },
    purple: {
      border: 'hover:border-[#9f7aea]/50',
      text: 'group-hover:text-[#9f7aea]',
      bg: 'bg-[#9f7aea]/10',
    },
    amber: {
      border: 'hover:border-[#ffb547]/50',
      text: 'group-hover:text-[#ffb547]',
      bg: 'bg-[#ffb547]/10',
    },
  };

  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[#01b574]/10">
            <BookOpen size={24} className={theme.textAccent} />
          </div>
          <h1 className="text-3xl font-bold">Strategy Guide</h1>
        </div>
        <p className={theme.textMuted}>
          Comprehensive guides for Rise of Kingdoms events, alliance coordination, and commander progression.
          Everything you need to dominate the battlefield.
        </p>
      </div>

      {/* Section Cards */}
      <div className="grid gap-6">
        {sections.map((section) => {
          const colors = colorClasses[section.color];
          return (
            <Link key={section.href} href={section.href}>
              <div
                className={`${theme.card} border rounded-xl p-6 transition-all ${colors.border} cursor-pointer group`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        {section.icon}
                      </div>
                      <h2 className={`text-xl font-semibold ${colors.text} transition-colors`}>
                        {section.title}
                      </h2>
                    </div>
                    <p className={`${theme.textMuted} mb-4`}>{section.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {section.items.map((item) => (
                        <span
                          key={item}
                          className={`text-xs px-2 py-1 rounded ${colors.bg} ${theme.textMuted}`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`${theme.textMuted} ${colors.text} transition-colors`}>
                    <ArrowRight size={20} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className={`mt-10 pt-8 border-t ${theme.border}`}>
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted} mb-4`}>
          Popular Guides
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Ark of Osiris', href: '/guide/events/ark-of-osiris' },
            { label: 'Guardian Runs', href: '/guide/alliance/guardians' },
            { label: 'MGE Strategy', href: '/guide/events/mightiest-governor' },
            { label: 'Commander Wizard', href: '/guide/commanders' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm px-3 py-2 rounded-lg ${theme.card} border ${theme.cardHover} transition-colors text-center`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
