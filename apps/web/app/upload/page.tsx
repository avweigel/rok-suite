'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { LockedPlaceholder } from '@/components/LockedPlaceholder';
import { ScanUploader } from '@/components/upload/ScanUploader';
import { UploadHistory } from '@/components/upload/UploadHistory';
import { meetsRole, useAuthRole } from '@/lib/auth-role';
import { WarRoomAuthProvider, useWarRoomAuth } from '@/lib/kvk-map/war-room-auth';

// The one place where kingdom scans are uploaded. Everything that needs scan
// data (Zero List, Power Growers — later Submit lead info, DKP, KD stats)
// reads what's uploaded here.
export default function UploadPage() {
  return (
    <AppSidebar>
      <WarRoomAuthProvider>
        <UploadPageInner />
      </WarRoomAuthProvider>
    </AppSidebar>
  );
}

function UploadPageInner() {
  // Either sign-in works: the header Sign in button or the Emigration one.
  const { role } = useAuthRole();
  const warRoom = useWarRoomAuth();
  const isAdmin = meetsRole(role, 'admin') || warRoom.isAtLeast('admin');
  const isOfficer = isAdmin || meetsRole(role, 'officer') || warRoom.isAtLeast('officer');
  const actor = warRoom.officerName?.trim() || (isAdmin ? 'admin' : 'officer');
  const [historyKey, setHistoryKey] = useState(0);

  if (!isOfficer) {
    return <LockedPlaceholder title="Upload Scan" description="Sign in as an officer or admin to see the scan uploads." />;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1100px] mx-auto px-3 sm:px-6 py-4 sm:py-10 space-y-4">
        <header>
          <h1 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">Upload Scan</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-2xl">
            Upload the <strong>location scan</strong> (scan_3923.csv) and the <strong>performance report</strong> (kd3923-performance-….xlsx).
            The two are matched by Gov ID and feed the Zero List (coords, power, shield, Acclaim) and Power Growers.
            Only <strong>CH25</strong> players are kept from the location scan.
          </p>
        </header>

        {isAdmin ? (
          <ScanUploader actor={actor} onUploaded={() => setHistoryKey((k) => k + 1)} />
        ) : (
          <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-4 text-xs text-[var(--text-secondary)]">
            Only admins can upload scans. The latest uploads are listed below.
          </section>
        )}

        <UploadHistory isAdmin={isAdmin} refreshKey={historyKey} />
      </div>
    </div>
  );
}
