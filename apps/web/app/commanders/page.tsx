'use client';

// Commanders: compare pairings, browse every commander by what its skills do, and build a roster from what you own.
// Not public yet (Davide, 2026-11-10): officers and admins only, and hidden from the menu for everybody else.
// The tool reads the address and draws charts, so it is loaded in the browser only.

import dynamic from 'next/dynamic';
import { AppSidebar } from '@/components/AppSidebar';
import { AuthGate } from '@/components/AuthGate';

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-5 h-5 border border-[#4318ff] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const CommandersTool = dynamic(() => import('@/components/commanders/CommandersTool'), { ssr: false, loading: Spinner });

export default function CommandersPage() {
  return (
    <AuthGate require="officer" sidebar title="Commanders" description="This section is not open yet: officers and admins only.">
      <AppSidebar>
        <CommandersTool />
      </AppSidebar>
    </AuthGate>
  );
}
