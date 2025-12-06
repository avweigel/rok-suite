'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Users, Swords, Target, Clock, ArrowRight } from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';

// Event data - this will eventually come from the database
const eventCategories = [
  {
    slug: 'solo',
    name: 'Solo Events',
    description: 'Individual competition and progression events',
    icon: <Target size={20} />,
    events: [
      { slug: 'mightiest-governor', name: 'Mightiest Governor', frequency: 'Bi-weekly' },
      { slug: 'more-than-gems', name: 'More Than Gems', frequency: 'Monthly' },
      { slug: 'wheel-of-fortune', name: 'Wheel of Fortune', frequency: 'Bi-weekly' },
      { slug: 'sunset-canyon', name: 'Sunset Canyon', frequency: 'Weekly' },
      { slug: 'lohars-trial', name: "Lohar's Trial", frequency: 'Monthly' },
      { slug: 'karuak-ceremony', name: 'Karuak Ceremony', frequency: 'Monthly' },
      { slug: 'golden-kingdom', name: 'Golden Kingdom', frequency: 'Periodic' },
    ],
  },
  {
    slug: 'alliance',
    name: 'Alliance Events',
    description: 'Events requiring alliance coordination',
    icon: <Users size={20} />,
    events: [
      { slug: 'ark-of-osiris', name: 'Ark of Osiris', frequency: 'Bi-weekly' },
      { slug: 'alliance-mobilization', name: 'Alliance Mobilization', frequency: 'Periodic' },
      { slug: 'silk-road', name: 'Silk Road Speculators', frequency: 'Periodic' },
      { slug: 'shadow-legion', name: 'Shadow Legion Invasion', frequency: 'Periodic' },
    ],
  },
  {
    slug: 'coop-pve',
    name: 'Co-op PvE',
    description: 'Cooperative player vs environment events',
    icon: <Swords size={20} />,
    events: [
      { slug: 'ceroli-crisis', name: 'Ceroli Crisis', frequency: 'Periodic' },
      { slug: 'ians-ballads', name: "Ian's Ballads", frequency: 'Periodic' },
    ],
  },
  {
    slug: 'pvp',
    name: 'PvP Events',
    description: 'Player vs player competitive events',
    icon: <Swords size={20} />,
    events: [
      { slug: 'champions-of-olympia', name: 'Champions of Olympia', frequency: 'Seasonal' },
      { slug: 'osiris-league', name: 'Osiris League', frequency: 'Seasonal' },
    ],
  },
];

export default function EventsPage() {
  const [darkMode, setDarkMode] = useState(true);

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
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <Calendar size={24} className={theme.textAccent} />
          </div>
          <h1 className="text-3xl font-bold">Events</h1>
        </div>
        <p className={theme.textMuted}>
          Comprehensive guides for all Rise of Kingdoms events. Learn mechanics, strategies,
          and get alliance-specific tips for success.
        </p>
      </div>

      {/* Event Categories */}
      <div className="space-y-8">
        {eventCategories.map((category) => (
          <div key={category.slug}>
            <div className="flex items-center gap-2 mb-4">
              <span className={theme.textMuted}>{category.icon}</span>
              <h2 className="text-lg font-semibold">{category.name}</h2>
              <span className={`text-sm ${theme.textMuted}`}>
                ({category.events.length})
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {category.events.map((event) => (
                <Link
                  key={event.slug}
                  href={`/guide/events/${event.slug}`}
                >
                  <div
                    className={`${theme.card} border rounded-lg p-4 transition-all hover:border-emerald-500/50 cursor-pointer group`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium group-hover:text-emerald-400 transition-colors">
                          {event.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={12} className={theme.textMuted} />
                          <span className={`text-xs ${theme.textMuted}`}>
                            {event.frequency}
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={16}
                        className={`${theme.textMuted} group-hover:text-emerald-400 transition-colors`}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Coming Soon Note */}
      <div className={`mt-10 p-4 rounded-lg ${theme.card} border`}>
        <p className={`text-sm ${theme.textMuted}`}>
          <strong className={theme.text}>Note:</strong> Event pages are being populated with strategies and checklists.
          Alliance leaders can edit and add custom content once logged in.
        </p>
      </div>
    </div>
  );
}
