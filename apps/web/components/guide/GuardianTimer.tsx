'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Bell, Settings, Check } from 'lucide-react';
import { Theme } from '@/lib/guide/theme';

interface GuardianTimerProps {
  spawnTime1: string; // HH:MM format in UTC
  spawnTime2: string; // HH:MM format in UTC
  theme: Theme;
  darkMode: boolean;
  onUpdateTimes?: (time1: string, time2: string) => Promise<boolean>;
  canEdit?: boolean;
}

interface TimeUntil {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getNextSpawnTime(spawnTime1: string, spawnTime2: string): { next: Date; label: string } {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const currentMinutes = utcHours * 60 + utcMinutes;

  const spawn1Minutes = parseTimeToMinutes(spawnTime1);
  const spawn2Minutes = parseTimeToMinutes(spawnTime2);

  // Determine which spawn is next
  let nextSpawnMinutes: number;
  let label: string;

  if (currentMinutes < spawn1Minutes) {
    nextSpawnMinutes = spawn1Minutes;
    label = 'Spawn 1';
  } else if (currentMinutes < spawn2Minutes) {
    nextSpawnMinutes = spawn2Minutes;
    label = 'Spawn 2';
  } else {
    // Both spawns have passed today, next is spawn1 tomorrow
    nextSpawnMinutes = spawn1Minutes + 24 * 60;
    label = 'Spawn 1';
  }

  // Calculate the next spawn time
  const minutesUntil = nextSpawnMinutes - currentMinutes;
  const nextSpawn = new Date(now.getTime() + minutesUntil * 60 * 1000);

  return { next: nextSpawn, label };
}

function getTimeUntil(targetDate: Date): TimeUntil {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, total: diff };
}

export function GuardianTimer({
  spawnTime1,
  spawnTime2,
  theme,
  darkMode,
  onUpdateTimes,
  canEdit = false,
}: GuardianTimerProps) {
  const [timeUntil, setTimeUntil] = useState<TimeUntil>({ hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [nextSpawnLabel, setNextSpawnLabel] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTime1, setEditTime1] = useState(spawnTime1);
  const [editTime2, setEditTime2] = useState(spawnTime2);
  const [isSaving, setIsSaving] = useState(false);

  const updateTimer = useCallback(() => {
    const { next, label } = getNextSpawnTime(spawnTime1, spawnTime2);
    setTimeUntil(getTimeUntil(next));
    setNextSpawnLabel(label);
  }, [spawnTime1, spawnTime2]);

  useEffect(() => {
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  const handleSave = async () => {
    if (!onUpdateTimes) return;
    setIsSaving(true);
    const success = await onUpdateTimes(editTime1, editTime2);
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const formatTime = (hours: number, minutes: number, seconds: number) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeUntil.total > 0 && timeUntil.total <= 15 * 60 * 1000; // 15 minutes

  return (
    <div className={`${theme.card} border rounded-xl overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${theme.border}`}>
        <div className="flex items-center gap-2">
          <Clock size={20} className={theme.textAccent} />
          <h3 className="font-semibold">Guardian Timer</h3>
        </div>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className={`p-1.5 rounded-lg ${theme.button}`}
            title="Edit spawn times"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Timer Display */}
      <div className="p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm ${theme.textMuted} mb-1`}>Spawn 1 (UTC)</label>
              <input
                type="time"
                value={editTime1}
                onChange={(e) => setEditTime1(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg ${theme.input} border ${theme.border}`}
              />
            </div>
            <div>
              <label className={`block text-sm ${theme.textMuted} mb-1`}>Spawn 2 (UTC)</label>
              <input
                type="time"
                value={editTime2}
                onChange={(e) => setEditTime2(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg ${theme.input} border ${theme.border}`}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className={`flex-1 px-3 py-2 rounded-lg ${theme.button}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex-1 px-3 py-2 rounded-lg ${theme.buttonPrimary} disabled:opacity-50`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Next spawn countdown */}
            <div className="text-center mb-6">
              <p className={`text-sm ${theme.textMuted} mb-2`}>
                Next Guardian Spawn ({nextSpawnLabel})
              </p>
              <div
                className={`text-4xl font-mono font-bold ${
                  isUrgent ? 'text-amber-400 animate-pulse' : theme.text
                }`}
              >
                {formatTime(timeUntil.hours, timeUntil.minutes, timeUntil.seconds)}
              </div>
              {isUrgent && (
                <div className="flex items-center justify-center gap-2 mt-3 text-amber-400">
                  <Bell size={16} />
                  <span className="text-sm font-medium">Get ready!</span>
                </div>
              )}
            </div>

            {/* Spawn times */}
            <div className={`grid grid-cols-2 gap-4 pt-4 border-t ${theme.border}`}>
              <div className="text-center">
                <p className={`text-xs ${theme.textMuted} mb-1`}>Spawn 1</p>
                <p className="font-mono font-medium">{spawnTime1} UTC</p>
              </div>
              <div className="text-center">
                <p className={`text-xs ${theme.textMuted} mb-1`}>Spawn 2</p>
                <p className="font-mono font-medium">{spawnTime2} UTC</p>
              </div>
            </div>

            {/* Local time conversion */}
            <div className={`mt-4 pt-4 border-t ${theme.border}`}>
              <p className={`text-xs ${theme.textMuted} text-center`}>
                Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="text-center">
                  <p className={`text-xs ${theme.textMuted}`}>Local</p>
                  <p className="font-mono text-sm">
                    {new Date(
                      Date.UTC(2000, 0, 1, ...spawnTime1.split(':').map(Number) as [number, number])
                    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-center">
                  <p className={`text-xs ${theme.textMuted}`}>Local</p>
                  <p className="font-mono text-sm">
                    {new Date(
                      Date.UTC(2000, 0, 1, ...spawnTime2.split(':').map(Number) as [number, number])
                    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
