'use client';

import { Suspense } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import KingdomStats from '@/components/kingdom/KingdomStats';
import { Kd23Stats } from '@/components/kingdom/Kd23Stats';
import { FEATURES } from '@/lib/feature-flags';

// The old multi-KD Kingdom Stats is switched off (FEATURES.kingdomStatsLegacy);
// the page shows the KD 23 player list built from the /upload scans.
export default function KingdomStatsPage() {
  return (
    <AppSidebar>
      <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
        {FEATURES.kingdomStatsLegacy ? <KingdomStats /> : <Kd23Stats />}
      </Suspense>
    </AppSidebar>
  );
}
