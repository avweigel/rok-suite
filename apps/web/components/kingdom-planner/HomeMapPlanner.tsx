'use client';

// The Home Kingdom Map section of the Kingdom Planner: the alliance land planner
// on k3923, with the walled zones and the baulur points on it (see MapPlannerSection).

import { useEffect, useState } from 'react';
import { baulurLayer, zoneLayer, zoneNamesLayer } from '@/components/kingdom-planner/mapLayers';
import { MapPlannerSection } from '@/components/kingdom-planner/MapPlannerSection';
import { zoneLabelFont } from '@/components/zones/zone-layers';
import { zoneAt } from '@/lib/zones/zones';

const EXTRA_LAYERS = [zoneLayer, zoneNamesLayer, baulurLayer];

export default function HomeMapPlanner() {
  const [layers, setLayers] = useState(EXTRA_LAYERS);

  useEffect(() => {
    // Canvas text doesn't wait for web fonts: draw the zone names again once it's here.
    void document.fonts?.load(`700 20px ${zoneLabelFont.style.fontFamily}`).then(() => setLayers([...EXTRA_LAYERS]), () => {});
  }, []);

  return <MapPlannerSection section="home-map" dataUrl="/rok-planner/k3923.json" backgroundUrl="/zones/map.jpg" extraLayers={layers} zoneOf={zoneAt} />;
}
