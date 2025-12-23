'use client';

import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';
import {
  Swords,
  Sun,
  Calculator,
  Scan,
  BookOpen,
  ArrowRight,
  Github,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function Home() {
  const tools = [
    {
      href: '/aoo-strategy',
      title: 'AoO Battle Planner',
      description: 'Interactive 30v30 team assignments, drag-drop battle maps, and match planning',
      icon: Swords,
      gradient: 'from-[#01b574] to-[#01b574]',
      shadowColor: 'shadow-[#01b574]/25',
      hoverBorder: 'hover:border-[#01b574]/50',
      badge: { text: 'Tool', color: 'bg-[#01b574]/20 text-[#01b574]' },
    },
    {
      href: '/scanners',
      title: 'Scanners',
      description: 'Scan screenshots to inventory commanders, equipment, and bag items',
      icon: Scan,
      gradient: 'from-[#4318ff] to-[#9f7aea]',
      shadowColor: 'shadow-[#4318ff]/25',
      hoverBorder: 'hover:border-[#4318ff]/50',
      badge: { text: 'Tool', color: 'bg-[#4318ff]/20 text-[#9f7aea]' },
    },
    {
      href: '/sunset-canyon',
      title: 'Sunset Canyon Simulator',
      description: 'Commander scanner, formation optimizer, and battle simulation',
      icon: Sun,
      gradient: 'from-[#ffb547] to-[#ffd97a]',
      shadowColor: 'shadow-[#ffb547]/25',
      hoverBorder: 'hover:border-[#ffb547]/50',
      badge: { text: 'Tool', color: 'bg-[#ffb547]/20 text-[#ffb547]' },
    },
    {
      href: '/upgrade-calculator',
      title: 'Upgrade Calculator',
      description: 'Building dependency graph and resource planning for City Hall upgrades',
      icon: Calculator,
      gradient: 'from-[#0075ff] to-[#21d4fd]',
      shadowColor: 'shadow-[#0075ff]/25',
      hoverBorder: 'hover:border-[#0075ff]/50',
      badge: { text: 'Tool', color: 'bg-[#0075ff]/20 text-[#21d4fd]' },
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f1535]">
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Gradient orbs for visual interest */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#4318ff]/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#01b574]/10 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-16 pb-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4318ff] to-[#9f7aea] flex items-center justify-center shadow-lg shadow-[#4318ff]/25">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">RoK Suite</h1>
              <p className="text-xs text-[#718096]">Angmar Nazgul Guards</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/avweigel/rok-suite"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[#a0aec0] hover:text-white hover:bg-white/10 transition-all"
              title="View on GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <UserMenu />
          </div>
        </header>

        {/* Hero */}
        <section className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4318ff]/10 border border-[#4318ff]/20 mb-6">
            <Sparkles className="w-4 h-4 text-[#9f7aea]" />
            <span className="text-sm font-medium text-[#9f7aea]">Strategy Tools for RoK</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
            Rise of Kingdoms
          </h2>
          <p className="text-xl text-[#a0aec0] mb-2">
            Strategy Tools & Battle Planning
          </p>
          <p className="text-sm text-[#4318ff]">
            Built for Angmar Nazgul Guards
          </p>
        </section>

        {/* Interactive Tools */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#718096] px-4">
              Interactive Tools
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="grid gap-4">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.href} href={tool.href}>
                  <div className={`group relative p-5 rounded-xl bg-[rgba(6,11,40,0.94)] border border-white/10 ${tool.hoverBorder} backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden`}>
                    {/* Hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative flex items-center gap-5">
                      {/* Icon */}
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg ${tool.shadowColor}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-base font-semibold text-white group-hover:text-white transition-colors">
                            {tool.title}
                          </h4>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${tool.badge.color}`}>
                            {tool.badge.text}
                          </span>
                        </div>
                        <p className="text-sm text-[#a0aec0]">{tool.description}</p>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-5 h-5 text-[#718096] group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Guides & Documentation */}
        <section className="mb-20">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#718096] px-4">
              Guides & Documentation
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="grid gap-4">
            <Link href="/guide">
              <div className="group relative p-5 rounded-xl bg-[rgba(6,11,40,0.94)] border border-white/10 hover:border-[#9f7aea]/50 backdrop-blur-xl transition-all duration-300 cursor-pointer overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative flex items-center gap-5">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#9f7aea] to-[#4318ff] shadow-lg shadow-[#9f7aea]/25">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-base font-semibold text-white">
                        Strategy Guide
                      </h4>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#9f7aea]/20 text-[#9f7aea]">
                        Docs
                      </span>
                    </div>
                    <p className="text-sm text-[#a0aec0]">
                      Event strategies, alliance protocols, commander guides, and checklists
                    </p>
                  </div>

                  <ArrowRight className="w-5 h-5 text-[#718096] group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-white/5 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <a
              href="https://github.com/avweigel/rok-suite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#718096] hover:text-white transition-colors flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <span className="text-[#718096]/30">•</span>
            <a
              href="https://avweigel.github.io/rok-suite/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#718096] hover:text-white transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Documentation
            </a>
          </div>
          <p className="text-xs text-[#718096]">
            Angmar Nazgul Guards • Rise of Kingdoms
          </p>
          <p className="text-[10px] text-[#718096]/50 mt-2">
            Built with Claude Code
          </p>
        </footer>
      </div>
    </div>
  );
}
