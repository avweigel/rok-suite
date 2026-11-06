'use client';

import { useState } from 'react';
import { Section } from '../components';

export interface GoPanelProps {
  hasPlan: boolean;
  onGo(x: number, y: number): void;
  onFitPlan(): void;
  onFitMap(): void;
}

export function GoPanel(p: GoPanelProps) {
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const nx = Number(x);
  const ny = Number(y);
  const ok = x.trim() !== '' && y.trim() !== '' && Number.isFinite(nx) && Number.isFinite(ny);
  const go = (): void => {
    if (ok) p.onGo(nx, ny);
  };
  return (
    <Section title="Go to" defaultOpen={false}>
      <div className="rokp-row">
        <input className="rokp-input rokp-num" inputMode="decimal" placeholder="X" aria-label="Go to x" value={x} onChange={(e) => setX(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <input className="rokp-input rokp-num" inputMode="decimal" placeholder="Y" aria-label="Go to y" value={y} onChange={(e) => setY(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button type="button" disabled={!ok} onClick={go}>
          Go
        </button>
      </div>
      <div className="rokp-row rokp-wrap">
        <button type="button" onClick={p.onFitMap}>
          Whole map
        </button>
        <button type="button" disabled={!p.hasPlan} onClick={p.onFitPlan} title="Zoom to everything the plan holds">
          My plan
        </button>
      </div>
    </Section>
  );
}
