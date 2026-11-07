'use client';

// Kingdom Planner (officers and admins): the AoO planner, the home kingdom
// map (alliance land planner with the walled zones, passes and baulur points)
// and the KvK map (the same planner on the Mighty Assembly). Shared plan links
// stay open to everyone: AoO (?plan=…), home map (?mplan=…), KvK map (?kplan=…).

import { useCallback, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Castle } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { LockedPlaceholder } from '@/components/LockedPlaceholder';
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
const HomeMapPlanner = dynamic(() => import('@/components/kingdom-planner/HomeMapPlanner'), { ssr: false, loading: Spinner });
const KvkMapPlanner = dynamic(() => import('@/components/kingdom-planner/KvkMapPlanner'), { ssr: false, loading: Spinner });

/** The address parameters of a map plan (see MapPlannerSection: each map has its own). */
const HOME_PARAMS = ['mplan', 'mpid'];
const KVK_PARAMS = ['kplan', 'kpid'];

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
  // A link to a map plan opens its map, when it does not say the section.
  const hasHomePlan = HOME_PARAMS.some((k) => searchParams.has(k));
  const hasKvkPlan = KVK_PARAMS.some((k) => searchParams.has(k));
  const section: SectionId = isSection(raw) ? raw : hasKvkPlan ? 'kvk-map' : hasHomePlan ? 'home-map' : 'aoo';
  // Once opened, a map stays mounted: a plan not saved yet lives in its state.
  const [mapOpened, setMapOpened] = useState(section === 'home-map');
  if (section === 'home-map' && !mapOpened) setMapOpened(true);
  const [kvkOpened, setKvkOpened] = useState(section === 'kvk-map');
  if (section === 'kvk-map' && !kvkOpened) setKvkOpened(true);
  const setSection = useCallback(
    (next: SectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'aoo' && ![...HOME_PARAMS, ...KVK_PARAMS].some((k) => params.has(k))) params.delete('section');
      else params.set('section', next);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/kingdom-planner', { scroll: false });
    },
    [router, searchParams],
  );

  if (!isClient) return <Spinner />;
  if (!canPlan) {
    // A shared plan link: the plan only.
    if (searchParams.get('plan')) return <AooPlanner officer={false} />;
    if (searchParams.get('kplan') && (raw === 'kvk-map' || !searchParams.get('mplan'))) return <KvkMapPlanner />;
    if (searchParams.get('mplan')) return <HomeMapPlanner />;
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

      {mapOpened && (
        <div className={section === 'home-map' ? undefined : 'hidden'}>
          <HomeMapPlanner />
        </div>
      )}

      {kvkOpened && (
        <div className={section === 'kvk-map' ? undefined : 'hidden'}>
          <KvkMapPlanner />
        </div>
      )}
    </div>
  );
}
