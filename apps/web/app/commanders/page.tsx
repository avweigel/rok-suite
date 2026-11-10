'use client';

// Commanders: compare pairings and browse every commander by what its skills do.
// The tool reads the address and draws charts, so it is loaded in the browser only.

import dynamic from 'next/dynamic';
import { AppSidebar } from '@/components/AppSidebar';

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
    <AppSidebar>
      <CommandersTool />
    </AppSidebar>
  );
}
