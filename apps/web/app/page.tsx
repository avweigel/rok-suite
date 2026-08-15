'use client';

import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import {
  Swords,
  GitBranch,
  ExternalLink,
  Calendar,
  Shield,
  Map,
  BarChart3,
  Calculator,
  Scale,
  ScrollText,
  Trophy,
  ClipboardList,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('home');

  const tools = [
    {
      href: '/calendar',
      titleKey: 'tools.calendar.title',
      descriptionKey: 'tools.calendar.description',
      icon: Calendar,
      hoverBorder: 'hover:border-rose-500/40',
      hoverShadow: 'hover:shadow-rose-500/10',
      iconHoverBg: 'group-hover:bg-rose-500/15',
      iconHoverColor: 'group-hover:text-rose-500',
    },
    {
      href: '/alliance-calculator',
      titleKey: 'tools.allianceCalculator.title',
      descriptionKey: 'tools.allianceCalculator.description',
      icon: Calculator,
      hoverBorder: 'hover:border-amber-500/40',
      hoverShadow: 'hover:shadow-amber-500/10',
      iconHoverBg: 'group-hover:bg-amber-500/15',
      iconHoverColor: 'group-hover:text-amber-500',
    },
    {
      href: '/fine-calculator',
      titleKey: 'tools.fineCalculator.title',
      descriptionKey: 'tools.fineCalculator.description',
      icon: Scale,
      hoverBorder: 'hover:border-amber-500/40',
      hoverShadow: 'hover:shadow-amber-500/10',
      iconHoverBg: 'group-hover:bg-amber-500/15',
      iconHoverColor: 'group-hover:text-amber-400',
    },
    {
      href: '/rok-mail',
      titleKey: 'tools.rokMail.title',
      descriptionKey: 'tools.rokMail.description',
      icon: ScrollText,
      hoverBorder: 'hover:border-pink-500/40',
      hoverShadow: 'hover:shadow-pink-500/10',
      iconHoverBg: 'group-hover:bg-pink-500/15',
      iconHoverColor: 'group-hover:text-pink-500',
    },
    {
      href: '/dkp',
      titleKey: 'tools.dkp.title',
      descriptionKey: 'tools.dkp.description',
      icon: Trophy,
      hoverBorder: 'hover:border-yellow-500/40',
      hoverShadow: 'hover:shadow-yellow-500/10',
      iconHoverBg: 'group-hover:bg-yellow-500/15',
      iconHoverColor: 'group-hover:text-yellow-500',
    },
    {
      href: '/alliances',
      titleKey: 'tools.alliances.title',
      descriptionKey: 'tools.alliances.description',
      icon: Users,
      hoverBorder: 'hover:border-sky-500/40',
      hoverShadow: 'hover:shadow-sky-500/10',
      iconHoverBg: 'group-hover:bg-sky-500/15',
      iconHoverColor: 'group-hover:text-sky-400',
    },
    {
      href: '/migration',
      titleKey: 'tools.migration.title',
      descriptionKey: 'tools.migration.description',
      icon: ClipboardList,
      hoverBorder: 'hover:border-orange-500/40',
      hoverShadow: 'hover:shadow-orange-500/10',
      iconHoverBg: 'group-hover:bg-orange-500/15',
      iconHoverColor: 'group-hover:text-orange-500',
    },
    {
      href: '/aoo-strategy',
      titleKey: 'tools.aoo.title',
      descriptionKey: 'tools.aoo.description',
      icon: Swords,
      hoverBorder: 'hover:border-emerald-500/40',
      hoverShadow: 'hover:shadow-emerald-500/10',
      iconHoverBg: 'group-hover:bg-emerald-500/15',
      iconHoverColor: 'group-hover:text-emerald-500',
    },
    {
      href: '/mge',
      titleKey: 'tools.mge.title',
      descriptionKey: 'tools.mge.description',
      icon: Shield,
      hoverBorder: 'hover:border-amber-500/40',
      hoverShadow: 'hover:shadow-amber-500/10',
      iconHoverBg: 'group-hover:bg-amber-500/15',
      iconHoverColor: 'group-hover:text-amber-500',
    },
    {
      href: '/kingdom/kingdom-stats',
      titleKey: 'tools.kingdomStats.title',
      descriptionKey: 'tools.kingdomStats.description',
      icon: BarChart3,
      hoverBorder: 'hover:border-green-500/40',
      hoverShadow: 'hover:shadow-green-500/10',
      iconHoverBg: 'group-hover:bg-green-500/15',
      iconHoverColor: 'group-hover:text-green-500',
    },
    {
      href: '/kvk-map',
      titleKey: 'tools.kvkMap.title',
      descriptionKey: 'tools.kvkMap.description',
      icon: Map,
      hoverBorder: 'hover:border-orange-500/40',
      hoverShadow: 'hover:shadow-orange-500/10',
      iconHoverBg: 'group-hover:bg-orange-500/15',
      iconHoverColor: 'group-hover:text-orange-500',
    },
    {
      href: '/apply',
      titleKey: 'tools.applyLeader.title',
      descriptionKey: 'tools.applyLeader.description',
      icon: UserPlus,
      hoverBorder: 'hover:border-violet-500/40',
      hoverShadow: 'hover:shadow-violet-500/10',
      iconHoverBg: 'group-hover:bg-violet-500/15',
      iconHoverColor: 'group-hover:text-violet-500',
    },
  ] as const;

  return (
    <AppSidebar>
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-20">
          {/* Hero */}
          <section className="mb-16">
            <p className="text-sm font-medium text-[var(--text-muted)] mb-3 tracking-wide uppercase">
              {t('tagline')}
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold text-[var(--foreground)] mb-5 tracking-tight leading-tight">
              {t('title')}
            </h1>
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
              {t('subtitle')}
            </p>
          </section>

          {/* Tools */}
          <section className="mb-14">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-5">
              {t('sections.interactiveTools')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.href} href={tool.href}>
                    <div className={`group p-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] ${tool.hoverBorder} hover:bg-[var(--background-hover)] hover:-translate-y-0.5 hover:shadow-[var(--card-shadow-hover)] ${tool.hoverShadow} transition-all duration-200 cursor-pointer h-full`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-[var(--background-secondary)] ${tool.iconHoverBg} transition-colors duration-200 flex-shrink-0`}>
                          <Icon className={`w-4 h-4 text-[var(--text-muted)] ${tool.iconHoverColor} transition-colors duration-200`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-[var(--foreground)] mb-0.5 transition-colors duration-200">
                            {t(tool.titleKey)}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {t(tool.descriptionKey)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-8 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-muted)]">
                {t('footer.copyright')}
              </p>
              <div className="flex items-center gap-5 text-sm">
                <a
                  href="https://github.com/avweigel/rok-suite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  GitHub
                </a>
                <a
                  href="https://avweigel.github.io/rok-suite/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Docs
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </AppSidebar>
  );
}
