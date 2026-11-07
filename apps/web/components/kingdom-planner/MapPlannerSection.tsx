'use client';

// A map section of the Kingdom Planner: the alliance land planner
// (components/rok-planner) on one map, home kingdom or KvK.
// Plans are saved in Supabase (map_plans, one list per map) by whoever signed
// in with Discord. The open plan is kept in the address, with parameters of
// its own per map so the two sections never pick up each other's plan:
// ?mplan= / ?mpid= for the home map, ?kplan= / ?kpid= for the KvK map.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MapPlanner, createSupabaseStore, sanitizePlan, type ExtraLayer, type PlanDoc, type ZoneOf } from '@/components/rok-planner/src';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

export type MapSectionId = 'home-map' | 'kvk-map';

/** The address parameters of each map: the share id and the owner's own plan id. */
export const MAP_PARAMS: Record<MapSectionId, { shared: string; own: string }> = {
  'home-map': { shared: 'mplan', own: 'mpid' },
  'kvk-map': { shared: 'kplan', own: 'kpid' },
};

/** "Import live map" (top right of the map): to be wired to the scanner tool. A thrown error is shown to the user. */
async function importLiveMap(section: MapSectionId): Promise<void> {
  void section;
  throw new Error('Import live map is not connected to the scanner tool yet.');
}

export interface MapPlannerSectionProps {
  section: MapSectionId;
  dataUrl: string;
  backgroundUrl: string;
  extraLayers?: ExtraLayer[];
  zoneOf?: ZoneOf;
}

export function MapPlannerSection({ section, dataUrl, backgroundUrl, extraLayers, zoneOf }: MapPlannerSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { signInWithDiscord, signOut, user: authUser } = useAuth();
  const store = useMemo(() => createSupabaseStore(createClient()), []);
  const keys = MAP_PARAMS[section];
  // The sign-in leaves the site, and an unsaved plan lives only in the page: it waits here for the way back.
  const draftKey = `rok-planner-draft:${section}`;
  const [draft] = useState<PlanDoc | undefined>(() => {
    try {
      const raw = window.sessionStorage.getItem(draftKey);
      return raw ? sanitizePlan(JSON.parse(raw)) : undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(draftKey);
    } catch { /* sessionStorage may be unavailable */ }
  }, [draftKey]);

  const onRequireSignIn = useCallback(
    (plan: PlanDoc) => {
      try {
        if (plan.items.length > 0 || plan.blank) window.sessionStorage.setItem(draftKey, JSON.stringify(plan));
      } catch { /* the plan just won't survive the trip */ }
      void signInWithDiscord();
    },
    [signInWithDiscord, draftKey],
  );

  // Keep the address in step with the open plan, leaving the page's other parameters alone.
  const onPlanChange = useCallback(
    ({ id, shareId }: { id: string | null; shareId: string | null }) => {
      const next = new URLSearchParams(window.location.search);
      next.delete(keys.shared);
      next.delete(keys.own);
      if (shareId) next.set(keys.shared, shareId);
      else if (id) next.set(keys.own, id);
      if (shareId || id) next.set('section', section);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, keys, section],
  );

  const shareUrl = useCallback((shareId: string) => `${window.location.origin}/kingdom-planner?section=${section}&${keys.shared}=${shareId}`, [section, keys]);
  const onImportLiveMap = useCallback(() => importLiveMap(section), [section]);

  return (
    <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-3">
      <MapPlanner
        dataUrl={dataUrl}
        backgroundUrl={backgroundUrl}
        store={store}
        sharedId={params.get(keys.shared) ?? undefined}
        planId={params.get(keys.own) ?? undefined}
        initialPlan={draft}
        onPlanChange={onPlanChange}
        shareUrl={shareUrl}
        onRequireSignIn={onRequireSignIn}
        extraLayers={extraLayers}
        zoneOf={zoneOf}
        providerName="Discord"
        authKey={authUser?.id ?? null}
        onSignOut={() => void signOut()}
        onImportLiveMap={onImportLiveMap}
        style={{ height: 'calc(100vh - 150px)', minHeight: 560 }}
      />
    </div>
  );
}
