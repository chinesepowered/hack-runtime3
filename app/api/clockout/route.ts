import { settleShift } from '@/lib/agent';
import { ndjson, release, withLock } from '@/lib/stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  return withLock(() => ndjson(settleShift(String(id ?? '')), release));
}
