'use client';

// The KvK Map section of the Kingdom Planner: the alliance land planner on the
// Mighty Assembly map (crusader camps, hierons, circles, the Great Ziggurat,
// citadels, bastions, passes and crystals). Its plans have their own list and
// their own address parameters (?kplan= / ?kpid=): see MapPlannerSection.

import { MapPlannerSection } from '@/components/kingdom-planner/MapPlannerSection';

/** The central zone (the Great Ziggurat and its four citadels), inside the walls of the 8 inner gates
 *  (passes at x 521.79 / 708.21 and y 494.99 / 675 in the scan): the game allows only flags there. */
const CENTRAL_ZONE: [number, number, number, number][] = [[521.79, 494.99, 708.21, 675]];

export default function KvkMapPlanner() {
  return (
    <MapPlannerSection
      section="kvk-map"
      dataUrl="/rok-planner/mighty_assembly.json"
      backgroundUrl="/rok-planner/mighty_assembly.jpg"
      noFort={CENTRAL_ZONE}
    />
  );
}
