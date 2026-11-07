'use client';

// The Home Kingdom Map section of the Kingdom Planner: the alliance land planner
// (components/rok-planner) with the walled zones and the baulur points on it.
// Plans are saved in Supabase (map_plans) by whoever signed in with Discord; the
// open plan is kept in the address as ?mplan=<share id> or ?mpid=<own plan id>.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MapPlanner, createSupabaseStore, sanitizePlan, type PlanDoc } from '@/components/rok-planner/src';
import { baulurLayer, zoneLayer, zoneNamesLayer } from '@/components/kingdom-planner/mapLayers';
import { zoneLabelFont } from '@/components/zones/zone-layers';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { zoneAt } from '@/lib/zones/zones';

const EXTRA_LAYERS = [zoneLayer, zoneNamesLayer, baulurLayer];

/** The sign-in leaves the site, and an unsaved plan lives only in the page:
 *  it waits here for the way back. */
const DRAFT_KEY = 'rok-planner-draft';

function readDraft(): PlanDoc | undefined {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? sanitizePlan(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

/** "Import live map" (top right of the map): to be wired to the scanner tool. A thrown error is shown to the user. */
async function importLiveMap(): Promise<void> {
  throw new Error('Import live map is not connected to the scanner tool yet.');
}

const shareUrl = (shareId: string) => `${window.location.origin}/kingdom-planner?section=home-map&mplan=${shareId}`;

export default function HomeMapPlanner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { signInWithDiscord, signOut, user: authUser } = useAuth();
  const store = useMemo(() => createSupabaseStore(createClient()), []);
  const [draft] = useState(readDraft);
  const [layers, setLayers] = useState(EXTRA_LAYERS);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* sessionStorage may be unavailable */ }
    // Canvas text doesn't wait for web fonts: draw the zone names again once it's here.
    void document.fonts?.load(`700 20px ${zoneLabelFont.style.fontFamily}`).then(() => setLayers([...EXTRA_LAYERS]), () => {});
  }, []);

  const onRequireSignIn = useCallback(
    (plan: PlanDoc) => {
      try {
        if (plan.items.length > 0) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
      } catch { /* the plan just won't survive the trip */ }
      void signInWithDiscord();
    },
    [signInWithDiscord],
  );

  // Keep the address in step with the open plan, leaving the page's other parameters alone.
  const onPlanChange = useCallback(
    ({ id, shareId }: { id: string | null; shareId: string | null }) => {
      const next = new URLSearchParams(window.location.search);
      next.delete('mplan');
      next.delete('mpid');
      if (shareId) next.set('mplan', shareId);
      else if (id) next.set('mpid', id);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return (
    <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-3">
      <MapPlanner
        dataUrl="/rok-planner/k3923.json"
        backgroundUrl="/zones/map.jpg"
        store={store}
        sharedId={params.get('mplan') ?? undefined}
        planId={params.get('mpid') ?? undefined}
        initialPlan={draft}
        onPlanChange={onPlanChange}
        shareUrl={shareUrl}
        onRequireSignIn={onRequireSignIn}
        extraLayers={layers}
        zoneOf={zoneAt}
        providerName="Discord"
        authKey={authUser?.id ?? null}
        onSignOut={() => void signOut()}
        onImportLiveMap={importLiveMap}
        style={{ height: 'calc(100vh - 150px)', minHeight: 560 }}
      />
    </div>
  );
}
