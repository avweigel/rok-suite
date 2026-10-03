/** Readable text for anything thrown. Supabase errors are plain objects with a
 *  `message`, not Error instances, so `String(e)` would give "[object Object]". */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message;
  return String(e);
}
