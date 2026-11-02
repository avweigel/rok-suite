'use client';

// Kingdom Planner (officers and admins): the AoO planner, the home kingdom
// map with the walled zones, passes and baulur points, and the KvK map (to
// come). A shared AoO plan link (?plan=…) stays open to everyone.

import { useCallback, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Castle, Map as MapIcon } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { LockedPlaceholder } from '@/components/LockedPlaceholder';
import { ZoneMap } from '@/components/zones/ZoneMap';
import { BAULUR_POINTS } from '@/lib/zones/zones';
import { meetsRole, useAuthRole } from '@/lib/auth-role';
import { WarRoomAuthProvider, useWarRoomAuth } from '@/lib/war-room-auth';

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-5 h-5 border border-[#4318ff] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const AooPlanner = dynamic(() => import('@/components/kingdom-planner/AooPlanner'), { ssr: false, loading: Spinner });

const SECTIONS = [
  { id: 'aoo', label: 'AOO' },
  { id: 'home-map', label: 'Home Kingdom Map' },
  { id: 'kvk-map', label: 'KvK Map' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
const isSection = (v: string | null): v is SectionId => SECTIONS.some((s) => s.id === v);

// The sign-in lives in browser storage: render nothing role-dependent on the server.
const subscribeNothing = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

export default function KingdomPlannerPage() {
  return (
    <AppSidebar>
      <WarRoomAuthProvider>
        <KingdomPlanner />
      </WarRoomAuthProvider>
    </AppSidebar>
  );
}

function KingdomPlanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useIsClient();
  const warRoom = useWarRoomAuth();
  const { role } = useAuthRole();
  const canPlan = warRoom.isAtLeast('officer') || meetsRole(role, 'officer');

  const raw = searchParams.get('section');
  const section: SectionId = isSection(raw) ? raw : 'aoo';
  const setSection = useCallback(
    (next: SectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'aoo') params.delete('section');
      else params.set('section', next);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/kingdom-planner', { scroll: false });
    },
    [router, searchParams],
  );

  if (!isClient) return <Spinner />;
  if (!canPlan) {
    // A shared AoO plan link: the plan only.
    if (searchParams.get('plan')) return <AooPlanner officer={false} />;
    return <LockedPlaceholder title="Kingdom Planner" description="Officer or admin access required." />;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
        <header className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/15">
            <Castle className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">Kingdom Planner</h1>
            <p className="hidden sm:block text-xs text-[var(--text-muted)]">AoO plans, the home kingdom map and the KvK map. Officers and admins only.</p>
          </div>
        </header>
        <nav className="flex gap-1 border-b border-[var(--border)] overflow-x-auto -mx-1 px-1 scrollbar-hide">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex-shrink-0 whitespace-nowrap ${
                section === s.id
                  ? 'border-[#4318ff] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {section === 'aoo' && <AooPlanner officer />}

      {section === 'home-map' && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="mx-auto w-full max-w-[calc(100vh-120px)]">
            <ZoneMap points={BAULUR_POINTS} pointsLabel="Baulur point" />
          </div>
        </div>
      )}

      {section === 'kvk-map' && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-10">
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background-card)] p-10 text-center">
            <MapIcon className="mx-auto mb-3 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">KvK Map</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Coming soon.</p>
          </div>
        </div>
      )}
    </div>
  );
}
