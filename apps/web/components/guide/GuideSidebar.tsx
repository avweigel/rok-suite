'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Shield,
  Users,
  Swords,
  Map,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Home,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Theme } from '@/lib/guide/theme';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const eventItems: NavItem['children'] = [
  { label: 'Ark of Osiris', href: '/guide/events/ark-of-osiris' },
  { label: 'Mightiest Governor', href: '/guide/events/mightiest-governor' },
  { label: 'More Than Gems', href: '/guide/events/more-than-gems' },
  { label: 'Ceroli Crisis', href: '/guide/events/ceroli-crisis' },
  { label: 'Ian\'s Ballads', href: '/guide/events/ians-ballads' },
  { label: 'Karuak Ceremony', href: '/guide/events/karuak-ceremony' },
  { label: 'Sunset Canyon', href: '/guide/events/sunset-canyon' },
  { label: 'Lohar\'s Trial', href: '/guide/events/lohars-trial' },
  { label: 'Golden Kingdom', href: '/guide/events/golden-kingdom' },
  { label: 'Champions of Olympia', href: '/guide/events/champions-of-olympia' },
];

const allianceItems: NavItem['children'] = [
  { label: 'Guardian Runs', href: '/guide/alliance/guardians' },
  { label: 'Territory Policy', href: '/guide/alliance/territory' },
  { label: 'Rally Protocol', href: '/guide/alliance/rallies' },
  { label: 'Alliance Rules', href: '/guide/alliance/rules' },
];

const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: '/guide',
    icon: <Home size={18} />,
  },
  {
    label: 'Events',
    href: '/guide/events',
    icon: <Calendar size={18} />,
    children: eventItems,
  },
  {
    label: 'Alliance',
    href: '/guide/alliance',
    icon: <Shield size={18} />,
    children: allianceItems,
  },
  {
    label: 'Commander Strategy',
    href: '/guide/commanders',
    icon: <Sparkles size={18} />,
  },
];

interface GuideSidebarProps {
  theme: Theme;
}

export function GuideSidebar({ theme }: GuideSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Events', 'Alliance']) // Start expanded
  );

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/guide') {
      return pathname === '/guide';
    }
    return pathname.startsWith(href);
  };

  const isChildActive = (children?: NavItem['children']) => {
    if (!children) return false;
    return children.some((child) => pathname === child.href);
  };

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedSections.has(item.label);
        const active = isActive(item.href);
        const childActive = isChildActive(item.children);

        return (
          <div key={item.href}>
            {hasChildren ? (
              <>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active || childActive
                      ? theme.sidebarActive
                      : `${theme.text} ${theme.sidebarHover}`
                  } ${active || childActive ? 'border-l-2' : 'border-l-2 border-transparent'}`}
                >
                  <span className="flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </span>
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children?.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          pathname === child.href
                            ? theme.sidebarActive
                            : `${theme.textMuted} ${theme.sidebarHover}`
                        } ${pathname === child.href ? 'border-l-2' : 'border-l-2 border-transparent'}`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? theme.sidebarActive
                    : `${theme.text} ${theme.sidebarHover}`
                } ${active ? 'border-l-2' : 'border-l-2 border-transparent'}`}
              >
                {item.icon}
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
