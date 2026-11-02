'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
export type WarRoomRole = 'viewer' | 'power' | 'officer' | 'admin';
import { ADMIN_PASSWORD, OFFICER_PASSWORD, POWER_PASSWORD } from '@/lib/auth-passwords';

const PASSWORDS: Record<Exclude<WarRoomRole, 'viewer'>, string> = {
  power: POWER_PASSWORD,
  officer: OFFICER_PASSWORD,
  admin: ADMIN_PASSWORD,
};

// 'power' is no longer a separate login tier — what was previously gated to
// power+ is now available with no login. Viewer and power share rank 1, so
// `isAtLeast('power')` returns true for anyone, including unlogged users.
const ROLE_RANK: Record<WarRoomRole, number> = { viewer: 1, power: 1, officer: 2, admin: 3 };

const OFFICER_NAME_KEY = 'warroom-officer-name';
const ROLE_KEY = 'warroom-role';

function isValidRole(v: string | null): v is WarRoomRole {
  return v === 'viewer' || v === 'power' || v === 'officer' || v === 'admin';
}

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
  const [role, setRole] = useState<WarRoomRole>('viewer');
  const [officerName, setOfficerNameState] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Restore officer name + role from localStorage on mount so signing in
  // persists across page navigations (each page wraps its own provider).
  useEffect(() => {
    const savedName = localStorage.getItem(OFFICER_NAME_KEY);
    if (savedName) setOfficerNameState(savedName);
    const savedRole = localStorage.getItem(ROLE_KEY);
    if (isValidRole(savedRole) && savedRole !== 'viewer') setRole(savedRole);
  }, []);

  const setOfficerName = useCallback((name: string | null) => {
    setOfficerNameState(name);
    if (name) {
      localStorage.setItem(OFFICER_NAME_KEY, name);
    } else {
      localStorage.removeItem(OFFICER_NAME_KEY);
    }
  }, []);

  const isAtLeast = useCallback(
    (minimumRole: WarRoomRole) => ROLE_RANK[role] >= ROLE_RANK[minimumRole],
    [role]
  );

  const login = useCallback((password: string): boolean => {
    // Check from most- to least-privileged so stronger creds win ties.
    if (PASSWORDS.admin && password === PASSWORDS.admin) {
      setRole('admin');
      localStorage.setItem(ROLE_KEY, 'admin');
      setShowLoginPrompt(false);
      return true;
    }
    if (PASSWORDS.officer && password === PASSWORDS.officer) {
      setRole('officer');
      localStorage.setItem(ROLE_KEY, 'officer');
      setShowLoginPrompt(false);
      return true;
    }
    if (PASSWORDS.power && password === PASSWORDS.power) {
      setRole('power');
      localStorage.setItem(ROLE_KEY, 'power');
      setShowLoginPrompt(false);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setRole('viewer');
    localStorage.removeItem(ROLE_KEY);
  }, []);

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
