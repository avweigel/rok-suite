'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Map, Swords, ScrollText, Shield, Loader2 } from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';
import { getAlliancePageData } from '@/lib/guide/alliance-data';
import { useUserRole, useAlliancePage } from '@/lib/supabase/use-guide';
import { EditableContent } from '@/components/guide/editor/EditableContent';

const iconMap: Record<string, React.ReactNode> = {
  Clock: <Clock size={24} />,
  Map: <Map size={24} />,
  Swords: <Swords size={24} />,
  ScrollText: <ScrollText size={24} />,
  Shield: <Shield size={24} />,
};

export default function AlliancePageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [darkMode, setDarkMode] = useState(true);
  const { isLeaderOrAdmin, loading: roleLoading } = useUserRole();

  // Fetch from database
  const { page: dbPage, loading: pageLoading, updatePage } = useAlliancePage(slug);

  // Fallback to static data
  const staticPage = getAlliancePageData(slug);

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const theme = getTheme(darkMode);

  // Use DB data if available, otherwise static fallback
  const pageData = dbPage || staticPage;
  const content = dbPage?.content || staticPage?.content || '';

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className={theme.textMuted}>This alliance page hasn&apos;t been created yet.</p>
        <Link href="/guide/alliance" className={`mt-4 inline-block ${theme.textAccent}`}>
          Back to Alliance
        </Link>
      </div>
    );
  }

  const icon = iconMap[pageData.icon || 'Shield'] || <Shield size={24} />;

  const handleSave = async (newContent: string): Promise<boolean> => {
    const result = await updatePage({ content: newContent, is_published: true });
    return result !== null;
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href="/guide/alliance"
        className={`inline-flex items-center gap-2 text-sm ${theme.textMuted} hover:${theme.text} mb-6`}
      >
        <ArrowLeft size={16} />
        Back to Alliance
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{pageData.title}</h1>
            <p className={`${theme.textMuted} mt-1`}>{pageData.description}</p>
          </div>
        </div>
      </div>

      {/* Leader notice */}
      {isLeaderOrAdmin && (
        <div className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-sm ${theme.textAccent}`}>
            <strong>Leader Access:</strong> You can edit this content directly. Changes are saved to the database and visible to all members.
          </p>
        </div>
      )}

      {/* Editable Content */}
      <EditableContent
        content={content}
        onSave={handleSave}
        canEdit={isLeaderOrAdmin && !roleLoading}
        theme={theme}
        darkMode={darkMode}
        placeholder="Add alliance content here..."
      />

      {/* Last Updated */}
      <div className={`mt-6 text-sm ${theme.textMuted} text-center`}>
        Content is managed by alliance leadership.
      </div>
    </div>
  );
}
