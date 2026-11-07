'use client';

// The War Room's sign-in (used by Migration, Upload, Kingdom Planner) is the
// site's own: the role comes from lib/auth-role (the Sign in button), so one
// login and one sign-out cover every page. Only the officer's name, used to
// sign the changes made on Migration, is kept here (localStorage).

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { dropLegacyLogin, useAuthRole } from '@/lib/auth-role';

export type WarRoomRole = 'viewer' | 'power' | 'officer' | 'admin';

// 'power' is no longer a separate tier here: viewer and power share rank 1,
// so `isAtLeast('power')` is true for anyone, signed in or not.
const ROLE_RANK: Record<WarRoomRole, number> = { viewer: 1, power: 1, officer: 2, admin: 3 };

const OFFICER_NAME_KEY = 'warroom-officer-name';

interface WarRoomAuthContextType {
  role: WarRoomRole;
  officerName: string | null;
  setOfficerName: (name: string | null) => void;
  isAtLeast: (minimumRole: WarRoomRole) => boolean;
  login: (password: string) => boolean;
  logout: () => void;
  showLoginPrompt: boolean;
  setShowLoginPrompt: (show: boolean) => void;
}

const WarRoomAuthContext = createContext<WarRoomAuthContextType | undefined>(undefined);

export function WarRoomAuthProvider({ children }: { children: ReactNode }) {
  const { role: siteRole, unlockWith, signOut } = useAuthRole();
  const role: WarRoomRole = siteRole ?? 'viewer';
  const [officerName, setOfficerNameState] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    dropLegacyLogin();
    const savedName = localStorage.getItem(OFFICER_NAME_KEY);
    if (savedName) setOfficerNameState(savedName);
  }, []);

  const setOfficerName = useCallback((name: string | null) => {
    setOfficerNameState(name);
    if (name) localStorage.setItem(OFFICER_NAME_KEY, name);
    else localStorage.removeItem(OFFICER_NAME_KEY);
  }, []);

  const isAtLeast = useCallback((minimumRole: WarRoomRole) => ROLE_RANK[role] >= ROLE_RANK[minimumRole], [role]);

  const login = useCallback(
    (password: string): boolean => {
      const ok = unlockWith(password) !== null;
      if (ok) setShowLoginPrompt(false);
      return ok;
    },
    [unlockWith],
  );

  const logout = useCallback(() => signOut(), [signOut]);

  return (
    <WarRoomAuthContext.Provider value={{ role, officerName, setOfficerName, isAtLeast, login, logout, showLoginPrompt, setShowLoginPrompt }}>
      {children}
    </WarRoomAuthContext.Provider>
  );
}

export function useWarRoomAuth() {
  const ctx = useContext(WarRoomAuthContext);
  if (!ctx) throw new Error('useWarRoomAuth must be used within WarRoomAuthProvider');
  return ctx;
}
