'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AgentEvent } from '@/lib/agent';
import type { Night, Shift } from '@/lib/night';

type State = {
  night: Night;
  rules: { tipOutPct: number; overrunMin: number; capUsd: number };
  payroll: { address: string | null; usd: number };
  wallets: { id: string; address: string; balance: number }[];
  live: { canSign: boolean };
};

const money = (x: number) => `$${x.toFixed(2)}`;
const clock = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
function elapsed(from: string, to: number) {
  const s = Math.max(0, Math.floor((to - Date.parse(from)) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function ShiftCard({ s, now, busy, onClockOut, onApprove }: { s: Shift; now: number; busy: boolean; onClockOut: () => void; onApprove: () => void }) {
  return (
    <article className="panel" data-testid={`shift-${s.id}`} data-status={s.status} style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{s.name}</h2>
          <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: '0.85rem' }}>
            {s.role} · {s.side === 'FOH' ? 'front of house' : 'back of house'} · ${s.rate}/hr
          </p>
        </div>
        <span className={`chip ${s.status}`}><span className="dot" />{s.status === 'working' ? 'On shift' : s.status === 'paid' ? 'Paid' : 'Held'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem', flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: '1.7rem', fontWeight: 700, color: s.status === 'working' ? 'var(--punch)' : 'var(--muted)' }}>
          {elapsed(s.clockIn, s.clockOut ? Date.parse(s.clockOut) : now)}
        </span>
        <span className="muted" style={{ fontSize: '0.82rem' }}>
          in {clock(s.clockIn)} · scheduled {clock(s.scheduledStart)}–{clock(s.scheduledEnd)}
        </span>
      </div>
      {s.status === 'working' && (
        <button className="btn" onClick={onClockOut} disabled={busy} data-testid={`clockout-${s.id}`}>Clock out</button>
      )}
      {s.status === 'held' && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--held)' }}>Held: {s.holdReason}</p>
          <button className="btn amber" onClick={onApprove} disabled={busy} data-testid={`approve-${s.id}`}>Approve as manager</button>
        </div>
      )}
      {s.status === 'paid' && s.paidUsd != null && (
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          <b>{money(s.paidUsd)}</b> paid at {clock(s.paidAt!)}
          {s.approvedByManager ? ' · manager approved' : ''}{' '}
          <a className="tx" href={`https://sepolia.basescan.org/tx/${s.payTx}`} target="_blank" rel="noreferrer">tx ↗</a>
        </p>
      )}
    </article>
  );
}

function Stub({ events }: { events: AgentEvent[] }) {
  const head = events.find(e => e.type === 'clockout') as Extract<AgentEvent, { type: 'clockout' }> | undefined;
  const result = events.find(e => e.type === 'pay' || e.type === 'hold' || e.type === 'unavailable' || e.type === 'error');
  return (
    <div className="receipt" data-testid="stub">
      <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: '0.12em' }}>LUCÍA’S · PAY STUB</div>
      {head ? (
        <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#5b6576', marginTop: '0.25rem' }}>
          {head.name.toUpperCase()} · {head.approved ? 'MANAGER APPROVED' : 'CLOCKED OUT'} {clock(head.at)}
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#5b6576', marginTop: '0.25rem' }}>waiting for a clock-out…</div>
      )}
      <hr />
      {events.filter(e => e.type === 'check').map((e, i) => {
        const c = (e as Extract<AgentEvent, { type: 'check' }>);
        const mark = c.check.ok ? '✓' : c.approved ? '✓*' : '✗';
        const color = c.check.ok ? '#139a63' : c.approved ? '#139a63' : '#c77612';
        return (
          <div key={`c${i}`} data-testid="check" data-ok={c.check.ok}>
            <div className="row"><span style={{ color, fontWeight: 700, width: '1.6rem' }}>{mark}</span><span>{c.check.label}</span></div>
            <div className="sub" style={{ paddingLeft: '2.1rem' }}>{c.check.detail}{c.approved ? ' — cleared by manager' : ''}</div>
          </div>
        );
      })}
      {events.some(e => e.type === 'line') && <hr />}
      {events.filter(e => e.type === 'line').map((e, i) => {
        const l = (e as Extract<AgentEvent, { type: 'line' }>).line;
        return (
          <div key={`l${i}`} data-testid="line">
            <div className="row"><span>{l.label}</span><span className="lead" /><span>{l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}</span></div>
            <div className="sub">{l.detail}</div>
          </div>
        );
      })}
      {events.filter(e => e.type === 'total').map((e, i) => (
        <div key={`t${i}`}>
          <hr />
          <div className="row" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            <span>TOTAL</span><span className="lead" /><span>{money((e as Extract<AgentEvent, { type: 'total' }>).amount)}</span>
          </div>
        </div>
      ))}
      {result && (
        <div style={{ marginTop: '1.1rem', display: 'grid', justifyItems: 'center', gap: '0.6rem', textAlign: 'center' }} data-testid="result">
          {result.type === 'pay' && (
            <>
              <span className="stamp paid">PAID {clock(result.at)}</span>
              <span style={{ fontSize: '0.78rem' }}>
                to {result.name}&apos;s wallet {result.to.slice(0, 6)}…{result.to.slice(-4)} ·{' '}
                <a href={result.url} target="_blank" rel="noreferrer" style={{ color: '#139a63', fontWeight: 700 }}>View on BaseScan ↗</a>
              </span>
            </>
          )}
          {result.type === 'hold' && (
            <>
              <span className="stamp held">HELD</span>
              <span style={{ fontSize: '0.78rem' }}>{result.reason}</span>
            </>
          )}
          {(result.type === 'unavailable' || result.type === 'error') && (
            <span style={{ fontSize: '0.8rem', color: '#c77612' }}>{result.type === 'error' ? result.message : result.reason}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Board() {
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState(await (await fetch('/api/night', { cache: 'no-store' })).json());
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function stream(path: string, id: string) {
    setBusy(true);
    setEvents([]);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setEvents([{ type: 'error', message: body.error ?? `HTTP ${res.status}` }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const l of lines) if (l.trim()) setEvents(prev => [...prev, JSON.parse(l) as AgentEvent]);
      }
    } finally {
      setBusy(false);
      void load();
    }
  }

  async function newNight() {
    setBusy(true);
    await fetch('/api/reset', { method: 'POST' });
    setEvents([]);
    await load();
    setBusy(false);
  }

  const night = state?.night;
  return (
    <div className="page" data-busy={busy}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        <div>
          <p className="eyebrow">Tonight at {night?.restaurant ?? '…'} · New York</p>
          <h1 className="headline" style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4rem)', marginTop: '0.4rem' }}>
            Clock out. <span style={{ color: 'var(--punch)' }}>Get paid.</span>
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: '2.2rem', fontWeight: 700 }} data-testid="clock">{clock(new Date(now))}</div>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            Payroll wallet (Dynamic) · <b style={{ color: 'var(--text)' }}>{state ? money(state.payroll.usd) : '…'}</b> ·
            kitchen tip pool <b style={{ color: 'var(--text)' }}>{night ? money(night.kitchenPool) : '…'}</b>
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <section style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))' }}>
          {night?.shifts.map(s => (
            <ShiftCard
              key={s.id}
              s={s}
              now={now}
              busy={busy}
              onClockOut={() => stream('/api/clockout', s.id)}
              onApprove={() => stream('/api/approve', s.id)}
            />
          ))}
        </section>
        <section style={{ position: 'sticky', top: '1rem' }}>
          <Stub events={events} />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <Link className="btn ghost" href="/me?w=rosa">Rosa&apos;s phone →</Link>
            <button className="btn ghost" onClick={newNight} disabled={busy}>Start a new night</button>
            {state && !state.live.canSign && <span className="chip held"><span className="dot" />Signing unavailable here</span>}
          </div>
        </section>
      </div>

      <p className="muted" style={{ fontSize: '0.76rem', marginTop: '2rem', lineHeight: 1.6 }}>
        Base Sepolia testnet. Wages and tips are paid in coUSD, a test dollar — not real money. Lucía’s and its staff are fictional;
        tips come from a seeded point-of-sale total. Every payout is a real on-chain transfer from the Dynamic payroll wallet.
      </p>
    </div>
  );
}
