'use client';

// CH25 players of the latest location scan (uploaded on /upload) — the source
// for name / Gov ID autofill outside the Zero List.

import { useEffect, useState } from 'react';
import { loadLatestLocationPoints, type LocationPoint } from '@/lib/zero-list/scan-data';
import { keptPoints } from './upload';

interface LatestScanPlayers {
  players: LocationPoint[];
  /** When the scan was taken; null when nothing has been uploaded yet. */
  scanAt: string | null;
  loading: boolean;
}

export function useLatestScanPlayers(): LatestScanPlayers {
  const [state, setState] = useState<LatestScanPlayers>({ players: [], scanAt: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { scan, points } = await loadLatestLocationPoints();
        if (!cancelled) setState({ players: keptPoints(points), scanAt: scan?.created_at ?? null, loading: false });
      } catch (e) {
        console.warn('Latest scan players failed to load', e);
        if (!cancelled) setState({ players: [], scanAt: null, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return state;
}
