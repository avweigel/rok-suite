'use client';

// Shared commanders: the commanders players share in the game's chat, read by rok-bot and pushed live (rok-bot/rok_commanders).
// Admin only for now (Davide, 2026-11-11) and hidden from the menu for everybody else; the data also needs a Supabase account sign-in.

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

const SharedCommanders = dynamic(() => import('@/components/commander-shares/SharedCommanders'), { ssr: false, loading: Spinner });

export default function SharedCommandersPage() {
  return (
    <AuthGate require="admin" sidebar title="Shared commanders" description="This section is not open yet: admins only.">
      <AppSidebar>
        <SharedCommanders />
      </AppSidebar>
    </AuthGate>
  );
}
