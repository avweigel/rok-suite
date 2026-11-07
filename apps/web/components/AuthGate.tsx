'use client';

import { useSyncExternalStore } from 'react';
import { meetsRole, useAuthRole, type AuthRole } from '@/lib/auth-role';
import { AppSidebar } from './AppSidebar';
import { LockedPlaceholder } from './LockedPlaceholder';

// The sign-in lives in browser storage: the server cannot know it, so nothing is shown until the browser does.
const subscribeNothing = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

/** Reusable role gate. When the user doesn't meet the required role we show
 *  the shared LockedPlaceholder which points back at the single SignInButton
 *  in the sidebar / header — no per-page password form to maintain.
 *  `require="power"` means any login (power, officer or admin). */
export function AuthGate({
  require,
  children,
  className,
  title,
  description,
  sidebar = false,
}: {
  require: AuthRole | AuthRole[];
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  /** Show the lock inside the site's sidebar (for pages whose own layout has it). */
  sidebar?: boolean;
}) {
  const { role } = useAuthRole();
  const isClient = useIsClient();

  if (!isClient) return null;
  if (meetsRole(role, require)) return <>{children}</>;

  const requiredList = Array.isArray(require) ? require : [require];
  const subtitle =
    description ??
    (requiredList.length === 1 && requiredList[0] === 'power'
      ? 'Sign in to see this section.'
      : requiredList.map((r) => r[0].toUpperCase() + r.slice(1)).join(' or ') + ' access required');

  const lock = <LockedPlaceholder title={title} description={subtitle} className={className} />;
  return sidebar ? <AppSidebar>{lock}</AppSidebar> : lock;
}
