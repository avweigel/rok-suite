'use client';

// The KvK Map section of the Kingdom Planner: the alliance land planner on the
// Mighty Assembly map (crusader camps, hierons, circles, the Great Ziggurat,
// citadels, bastions, passes and crystals). Its plans have their own list and
// their own address parameters (?kplan= / ?kpid=): see MapPlannerSection.

import { MapPlannerSection } from '@/components/kingdom-planner/MapPlannerSection';

export default function KvkMapPlanner() {
  return <MapPlannerSection section="kvk-map" dataUrl="/rok-planner/mighty_assembly.json" backgroundUrl="/rok-planner/mighty_assembly.jpg" />;
}
