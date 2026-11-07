import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';

// Where the sign-in callback sends people when it fails: what went wrong, and the way back.
export default async function AuthCodeErrorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? '';
  const reason = one(sp.reason) || 'The sign-in did not complete.';
  const asked = one(sp.next);
  const next = asked.startsWith('/') && !asked.startsWith('//') ? asked : '/';
  return (
    <AppSidebar>
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background-card)] p-6 space-y-3">
          <h1 className="text-base font-semibold text-[var(--foreground)]">Sign-in failed</h1>
          <p className="text-sm text-[var(--text-secondary)]">{reason}</p>
          <p className="text-xs text-[var(--text-muted)]">Try again from the page you were on. If it keeps failing, send this message to an admin.</p>
          <Link href={next} className="inline-block text-sm text-sky-400 hover:underline">
            Back
          </Link>
        </div>
      </div>
    </AppSidebar>
  );
}
