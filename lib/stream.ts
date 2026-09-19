import type { AgentEvent } from './agent';

/** Stream agent events as NDJSON so the board can render each step as it happens. */
export function ndjson(events: AsyncGenerator<AgentEvent>, onDone?: () => void): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const e of events) controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
      } catch (err) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: (err as Error).message?.slice(0, 200) }) + '\n'));
      } finally {
        onDone?.();
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}

/** One settlement at a time per instance, so two payouts never race the payroll wallet's nonce. */
let busy = false;
export function withLock(run: () => Response): Response {
  if (busy) return Response.json({ error: 'The agent is finishing another payout — one moment.' }, { status: 429 });
  busy = true;
  try {
    return run();
  } catch (err) {
    busy = false;
    throw err;
  }
}
export const release = () => {
  busy = false;
};
