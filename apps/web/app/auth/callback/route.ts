import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Only a path on this site: never another host.
  const asked = searchParams.get('next') ?? '/';
  const next = asked.startsWith('/') && !asked.startsWith('//') ? asked : '/';

  let reason = searchParams.get('error_description') ?? searchParams.get('error') ?? '';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    reason = error.message;
  } else if (!reason) {
    reason = 'No sign-in code came back from the provider.';
  }

  // Say what went wrong, and offer the way back.
  const back = new URLSearchParams({ reason, next });
  return NextResponse.redirect(`${origin}/auth/auth-code-error?${back}`);
}
