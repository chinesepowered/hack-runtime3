import { settleShift } from '@/lib/agent';
import { ndjson, release, withLock } from '@/lib/stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** A manager clears a held shift. The agent re-verifies and pays; hard checks still apply. */
export async function POST(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  return withLock(() => ndjson(settleShift(String(id ?? ''), true), release));
}
