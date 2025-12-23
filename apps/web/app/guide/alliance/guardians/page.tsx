'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Clock, Loader2 } from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';
import { getAlliancePageData } from '@/lib/guide/alliance-data';
import { useUserRole, useAlliancePage, useGuardianSchedule } from '@/lib/supabase/use-guide';
import { EditableContent } from '@/components/guide/editor/EditableContent';
import { GuardianTimer } from '@/components/guide/GuardianTimer';

export default function GuardiansPage() {
  const [darkMode, setDarkMode] = useState(true);
  const { isLeaderOrAdmin, loading: roleLoading } = useUserRole();

  // Fetch from database
  const { page: dbPage, loading: pageLoading, updatePage } = useAlliancePage('guardians');
  const { schedule, loading: scheduleLoading, updateSchedule } = useGuardianSchedule();

  // Fallback to static data
  const staticPage = getAlliancePageData('guardians');

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const theme = getTheme();

  // Use DB data if available, otherwise static fallback
  const content = dbPage?.content || staticPage?.content || '';

  // Parse time strings from database (format: HH:MM:SS) to HH:MM
  const spawnTime1 = schedule?.spawn_time_1?.slice(0, 5) || '12:00';
  const spawnTime2 = schedule?.spawn_time_2?.slice(0, 5) || '00:00';

  const handleSaveContent = async (newContent: string): Promise<boolean> => {
    const result = await updatePage({ content: newContent, is_published: true });
    return result !== null;
  };

  const handleUpdateTimes = async (time1: string, time2: string): Promise<boolean> => {
    const result = await updateSchedule({
      spawn_time_1: time1 + ':00',
      spawn_time_2: time2 + ':00',
    });
    return result !== null;
  };

  if (pageLoading || scheduleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

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
            <Clock size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{dbPage?.title || staticPage?.title || 'Guardian Runs'}</h1>
            <p className={`${theme.textMuted} mt-1`}>
              {dbPage?.description || staticPage?.description || 'Schedule and protocol for guardian kills'}
            </p>
          </div>
        </div>
      </div>

      {/* Leader notice */}
      {isLeaderOrAdmin && (
        <div className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-sm ${theme.textAccent}`}>
            <strong>Leader Access:</strong> You can edit spawn times and content. Changes are saved to the database.
          </p>
        </div>
      )}

      {/* Timer Widget */}
      <div className="mb-8">
        <GuardianTimer
          spawnTime1={spawnTime1}
          spawnTime2={spawnTime2}
          theme={theme}
          darkMode={darkMode}
          onUpdateTimes={handleUpdateTimes}
          canEdit={isLeaderOrAdmin && !roleLoading}
        />
      </div>

      {/* Quick Reference */}
      <div className={`${theme.card} border rounded-xl p-6 mb-8`}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield size={18} className={theme.textAccent} />
          Quick Reference
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${theme.textMuted} mb-1`}>Before Spawn</p>
            <p className="text-sm">Be online 5 min early</p>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${theme.textMuted} mb-1`}>During Kill</p>
            <p className="text-sm">Wait for the call to attack</p>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${theme.textMuted} mb-1`}>After Kill</p>
            <p className="text-sm">Move to next target</p>
          </div>
        </div>
      </div>

      {/* Full Protocol Content */}
      <EditableContent
        content={content}
        onSave={handleSaveContent}
        canEdit={isLeaderOrAdmin && !roleLoading}
        theme={theme}
        darkMode={darkMode}
        title="Full Protocol"
        placeholder="Add guardian run protocol here..."
      />

      {/* Last Updated */}
      <div className={`mt-6 text-sm ${theme.textMuted} text-center`}>
        Content is managed by alliance leadership.
      </div>
    </div>
  );
}
