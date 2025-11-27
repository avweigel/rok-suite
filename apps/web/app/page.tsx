'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('aoo-theme', newMode ? 'dark' : 'light');
  };

  const theme = {
    bg: darkMode ? 'bg-zinc-950' : 'bg-gray-50',
    card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
    text: darkMode ? 'text-zinc-100' : 'text-gray-900',
    textMuted: darkMode ? 'text-zinc-400' : 'text-gray-500',
    textAccent: darkMode ? 'text-emerald-400' : 'text-emerald-600',
    border: darkMode ? 'border-zinc-800' : 'border-gray-200',
    button: darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-200`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <header className={`flex items-center justify-between mb-12 pb-4 border-b ${theme.border}`}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Angmar Alliance</h1>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${theme.button} transition-colors`}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </header>

        {/* Hero */}
        <section className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Rise of Kingdoms
          </h2>
          <p className={`text-lg ${theme.textMuted} mb-2`}>
            Strategy Tools & Battle Planning
          </p>
          <p className={`text-sm ${theme.textAccent}`}>
            Angmar Legion
          </p>
        </section>

        {/* Strategy Tools */}
        <section className="mb-16">
          <h3 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted} mb-4`}>
            Strategy Tools
          </h3>

          <div className="grid gap-4">
            {/* Ark of Osiris Card */}
            <Link href="/aoo-strategy">
              <div className={`${theme.card} border rounded-xl p-6 transition-all hover:border-emerald-500/50 cursor-pointer group`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold mb-1 group-hover:text-emerald-400 transition-colors">
                      Ark of Osiris
                    </h4>
                    <p className={`text-sm ${theme.textMuted}`}>
                      30v30 team assignments, battle maps, and strategy notes
                    </p>
                  </div>
                  <div className={`${theme.textMuted} group-hover:text-emerald-400 transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* Sunset Canyon Simulator Card */}
            <Link href="/sunset-canyon">
              <div className={`${theme.card} border rounded-xl p-6 transition-all hover:border-amber-500/50 cursor-pointer group`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold mb-1 group-hover:text-amber-400 transition-colors">
                      Sunset Canyon
                    </h4>
                    <p className={`text-sm ${theme.textMuted}`}>
                      Battle simulator for commander formations and win rate analysis
                    </p>
                  </div>
                  <div className={`${theme.textMuted} group-hover:text-amber-400 transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* Placeholder for future tools */}
            <div className={`${theme.card} border rounded-xl p-6 opacity-50`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold mb-1">
                    KvK Planner
                  </h4>
                  <p className={`text-sm ${theme.textMuted}`}>
                    Coming soon
                  </p>
                </div>
                <div className={theme.textMuted}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`${theme.card} border rounded-xl p-6 opacity-50`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold mb-1">
                    Rally Calculator
                  </h4>
                  <p className={`text-sm ${theme.textMuted}`}>
                    Coming soon
                  </p>
                </div>
                <div className={theme.textMuted}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={`pt-8 border-t ${theme.border} text-center`}>
          <p className={`text-xs ${theme.textMuted}`}>
            Angmar Alliance • Rise of Kingdoms
          </p>
        </footer>
      </div>
    </div>
  );
}