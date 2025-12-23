'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Users,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Edit3,
  Building,
} from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';
import { getEventData, EventData } from '@/lib/guide/events-data';
import { useUserRole } from '@/lib/supabase/use-guide';
import { useAuth } from '@/lib/supabase/auth-context';
import ReactMarkdown from 'react-markdown';

interface ChecklistItemProps {
  item: { content: string; details?: string };
  checked: boolean;
  onToggle: () => void;
  theme: ReturnType<typeof getTheme>;
}

function ChecklistItem({ item, checked, onToggle, theme }: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${theme.cardHover}`}
        onClick={onToggle}
      >
        <button className="mt-0.5 shrink-0">
          {checked ? (
            <CheckCircle2 size={20} className="text-emerald-500" />
          ) : (
            <Circle size={20} className={theme.textMuted} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <span className={checked ? 'line-through opacity-60' : ''}>
            {item.content}
          </span>
          {item.details && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className={`ml-2 text-xs ${theme.textMuted} hover:${theme.text}`}
            >
              {expanded ? '(hide details)' : '(details)'}
            </button>
          )}
        </div>
      </div>
      {expanded && item.details && (
        <p className={`ml-11 text-sm ${theme.textMuted} pb-2`}>{item.details}</p>
      )}
    </div>
  );
}

interface ChecklistSectionProps {
  checklist: NonNullable<EventData['checklists']>[number];
  theme: ReturnType<typeof getTheme>;
  darkMode: boolean;
}

function ChecklistSection({ checklist, theme, darkMode }: ChecklistSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const resetChecklist = () => {
    setCheckedItems(new Set());
  };

  const progress = checklist.items.length > 0
    ? Math.round((checkedItems.size / checklist.items.length) * 100)
    : 0;

  return (
    <div className={`${theme.card} border rounded-lg overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 ${theme.cardHover} transition-colors`}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <div className="text-left">
            <h4 className="font-semibold">{checklist.title}</h4>
            {checklist.description && (
              <p className={`text-sm ${theme.textMuted}`}>{checklist.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-sm ${theme.textMuted}`}>
            {checkedItems.size}/{checklist.items.length}
          </div>
          <div className={`w-16 h-2 rounded-full ${darkMode ? 'bg-zinc-700' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </button>
      {expanded && (
        <div className={`border-t ${theme.border}`}>
          <div className="divide-y divide-zinc-800/50">
            {checklist.items.map((item, index) => (
              <ChecklistItem
                key={index}
                item={item}
                checked={checkedItems.has(index)}
                onToggle={() => toggleItem(index)}
                theme={theme}
              />
            ))}
          </div>
          {checkedItems.size > 0 && (
            <div className={`p-3 border-t ${theme.border}`}>
              <button
                onClick={resetChecklist}
                className={`text-sm ${theme.textMuted} hover:${theme.text}`}
              >
                Reset checklist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'checklists'>('overview');
  const router = useRouter();
  const { isOfficerOrAbove } = useUserRole();
  const { user } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const theme = getTheme();
  const event = getEventData(slug);

  if (!event) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
        <p className={theme.textMuted}>This event guide hasn&apos;t been created yet.</p>
        <Link href="/guide/events" className={`mt-4 inline-block ${theme.textAccent}`}>
          Back to Events
        </Link>
      </div>
    );
  }

  const categoryColors: Record<string, string> = {
    solo: darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
    alliance: darkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
    'coop-pve': darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
    pvp: darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
    continuous: darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700',
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'strategies', label: 'Strategies', count: event.strategies?.length },
    { id: 'checklists', label: 'Checklists', count: event.checklists?.length },
  ];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/guide/events"
        className={`inline-flex items-center gap-2 text-sm ${theme.textMuted} hover:${theme.text} mb-6`}
      >
        <ArrowLeft size={16} />
        Back to Events
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full ${categoryColors[event.category]}`}>
                {event.category.replace('-', ' ')}
              </span>
              <span className={`flex items-center gap-1 text-sm ${theme.textMuted}`}>
                <Clock size={14} />
                {event.frequency}
              </span>
              {event.duration && (
                <span className={`text-sm ${theme.textMuted}`}>
                  Duration: {event.duration}
                </span>
              )}
              {event.minCityHall && (
                <span className={`flex items-center gap-1 text-sm ${theme.textMuted}`}>
                  <Building size={14} />
                  CH {event.minCityHall}+
                </span>
              )}
            </div>
          </div>
          {isOfficerOrAbove && (
            <button
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${theme.button} text-sm`}
              title="Edit event (coming soon)"
            >
              <Edit3 size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-lg ${darkMode ? 'bg-zinc-900' : 'bg-gray-100'} mb-6`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? `${darkMode ? 'bg-zinc-800' : 'bg-white'} ${theme.text}`
                : theme.textMuted
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 text-xs ${theme.textMuted}`}>({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="prose prose-invert max-w-none">
          <div className={`${theme.card} border rounded-lg p-6`}>
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className={`mb-4 ${theme.textMuted}`}>{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className={theme.textMuted}>{children}</li>,
                strong: ({ children }) => <strong className={theme.text}>{children}</strong>,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full border-collapse">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className={`text-left p-2 border-b ${theme.border} font-medium`}>{children}</th>
                ),
                td: ({ children }) => (
                  <td className={`p-2 border-b ${theme.border} ${theme.textMuted}`}>{children}</td>
                ),
              }}
            >
              {event.overview}
            </ReactMarkdown>

            {event.mechanics && (
              <>
                <hr className={`my-6 ${theme.border}`} />
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className={`mb-4 ${theme.textMuted}`}>{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                    li: ({ children }) => <li className={theme.textMuted}>{children}</li>,
                    strong: ({ children }) => <strong className={theme.text}>{children}</strong>,
                  }}
                >
                  {event.mechanics}
                </ReactMarkdown>
              </>
            )}

            {event.rewards && (
              <>
                <hr className={`my-6 ${theme.border}`} />
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className={`mb-4 ${theme.textMuted}`}>{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                    li: ({ children }) => <li className={theme.textMuted}>{children}</li>,
                    strong: ({ children }) => <strong className={theme.text}>{children}</strong>,
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full border-collapse">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className={`text-left p-2 border-b ${theme.border} font-medium`}>{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className={`p-2 border-b ${theme.border} ${theme.textMuted}`}>{children}</td>
                    ),
                  }}
                >
                  {event.rewards}
                </ReactMarkdown>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'strategies' && (
        <div className="space-y-6">
          {event.strategies && event.strategies.length > 0 ? (
            event.strategies.map((strategy, index) => (
              <div key={index} className={`${theme.card} border rounded-lg p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{strategy.title}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      strategy.type === 'alliance'
                        ? 'bg-purple-500/20 text-purple-400'
                        : strategy.type === 'tips'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {strategy.type}
                  </span>
                </div>
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="font-medium mt-3 mb-1">{children}</h3>,
                    p: ({ children }) => <p className={`mb-3 ${theme.textMuted}`}>{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className={theme.textMuted}>{children}</li>,
                    strong: ({ children }) => <strong className={theme.text}>{children}</strong>,
                  }}
                >
                  {strategy.content}
                </ReactMarkdown>
              </div>
            ))
          ) : (
            <div className={`${theme.card} border rounded-lg p-8 text-center`}>
              <p className={theme.textMuted}>No strategies added yet.</p>
              {isOfficerOrAbove && (
                <button className={`mt-4 ${theme.buttonPrimary} px-4 py-2 rounded-lg text-sm`}>
                  Add Strategy
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'checklists' && (
        <div className="space-y-4">
          {event.checklists && event.checklists.length > 0 ? (
            event.checklists.map((checklist, index) => (
              <ChecklistSection
                key={index}
                checklist={checklist}
                theme={theme}
                darkMode={darkMode}
              />
            ))
          ) : (
            <div className={`${theme.card} border rounded-lg p-8 text-center`}>
              <p className={theme.textMuted}>No checklists added yet.</p>
              {isOfficerOrAbove && (
                <button className={`mt-4 ${theme.buttonPrimary} px-4 py-2 rounded-lg text-sm`}>
                  Add Checklist
                </button>
              )}
            </div>
          )}

          {!user && event.checklists && event.checklists.length > 0 && (
            <p className={`text-sm ${theme.textMuted} text-center mt-4`}>
              Sign in to save your checklist progress across sessions.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
