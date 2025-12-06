'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';

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
            <h1 className="text-xl font-semibold tracking-tight">Angmar Nazgul Guards</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/avweigel/rok-suite"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title="View on GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <UserMenu />
          </div>
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
            Angmar Nazgul Guards
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

            {/* Upgrade Calculator Card */}
            <Link href="/upgrade-calculator">
              <div className={`${theme.card} border rounded-xl p-6 transition-all hover:border-blue-500/50 cursor-pointer group`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold mb-1 group-hover:text-blue-400 transition-colors">
                      Upgrade Calculator
                    </h4>
                    <p className={`text-sm ${theme.textMuted}`}>
                      Plan your path from one City Hall to the next with optimal resources
                    </p>
                  </div>
                  <div className={`${theme.textMuted} group-hover:text-blue-400 transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* Strategy Guide Card */}
            <Link href="/guide">
              <div className={`${theme.card} border rounded-xl p-6 transition-all hover:border-purple-500/50 cursor-pointer group`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold mb-1 group-hover:text-purple-400 transition-colors">
                      Strategy Guide
                    </h4>
                    <p className={`text-sm ${theme.textMuted}`}>
                      Event guides, alliance protocols, and commander strategies
                    </p>
                  </div>
                  <div className={`${theme.textMuted} group-hover:text-purple-400 transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

          </div>
        </section>

        {/* Footer */}
        <footer className={`pt-8 border-t ${theme.border} text-center`}>
          <div className="flex items-center justify-center gap-4 mb-3">
            <a
              href="https://github.com/avweigel/rok-suite"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${theme.textMuted} hover:${theme.textAccent} transition-colors flex items-center gap-1.5`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
            <span className={theme.textMuted}>•</span>
            <a
              href="https://avweigel.github.io/rok-suite/"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${theme.textMuted} hover:${theme.textAccent} transition-colors flex items-center gap-1.5`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Docs
            </a>
          </div>
          <p className={`text-xs ${theme.textMuted}`}>
            Angmar Nazgul Guards • Rise of Kingdoms
          </p>
          <p className={`text-[10px] ${theme.textMuted} mt-2 opacity-50`}>
            🐰 Fluffy approved • Not medical advice (despite what Moon claims)
          </p>
        </footer>
      </div>
    </div>
  );
}