'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { Night } from '@/lib/night';

type State = { night: Night; wallets: { id: string; address: string; balance: number }[] };

const money = (x: number) => `$${x.toFixed(2)}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

/** The Friday a typical biweekly payroll would pay a shift worked on `iso`: the first Friday at least 8 days out. */
function biweeklyPayday(iso: string): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + 8);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d;
}

function Phone() {
  const id = useSearchParams().get('w') ?? 'rosa';
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    void fetch('/api/night', { cache: 'no-store' }).then(r => r.json()).then(setState);
  }, []);
  const shift = state?.night.shifts.find(s => s.id === id);
  const wallet = state?.wallets.find(w => w.id === id);
  const paid = shift?.status === 'paid' && shift.paidAt && shift.clockOut;
  const seconds = paid ? Math.max(1, Math.round((Date.parse(shift.paidAt!) - Date.parse(shift.clockOut!)) / 1000)) : 0;
  const payday = paid ? biweeklyPayday(shift.paidAt!) : null;
  const days = payday ? Math.round((payday.getTime() - Date.parse(shift!.paidAt!)) / 86_400_000) : 0;

  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center' }}>
      <div
        data-testid="phone"
        style={{
          width: 'min(24rem, 100%)', borderRadius: '2.6rem', padding: '0.75rem', background: '#05090f',
          border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 40px 90px -30px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ borderRadius: '2rem', background: 'linear-gradient(180deg, #16263d, #0e1a2b)', padding: '2.2rem 1.5rem 2rem', minHeight: '38rem' }}>
          <div style={{ width: '6rem', height: '1.4rem', borderRadius: '999px', background: '#05090f', margin: '-1.4rem auto 1.8rem' }} />
          {!shift && <p className="muted">Loading…</p>}
          {shift && !paid && (
            <>
              <p className="eyebrow">{shift.name}</p>
              <h1 className="headline" style={{ fontSize: '2.2rem', marginTop: '0.6rem' }}>
                {shift.status === 'held' ? 'Waiting on a manager.' : 'Still on shift.'}
              </h1>
              <p className="muted" style={{ lineHeight: 1.6 }}>
                {shift.status === 'held' ? shift.holdReason : 'Your pay lands the moment you clock out.'}
              </p>
            </>
          )}
          {shift && paid && (
            <>
              <p className="eyebrow">{state!.night.restaurant} paid you</p>
              <div className="headline mono" style={{ fontSize: '3.6rem', color: 'var(--paid)', margin: '0.7rem 0 0.3rem' }} data-testid="amount">
                {money(shift.paidUsd!)}
              </div>
              <p style={{ margin: 0, fontSize: '1.05rem' }}>
                at {clock(shift.paidAt!)} — <b>{seconds} second{seconds === 1 ? '' : 's'}</b> after you clocked out.
              </p>
              <div className="panel" style={{ marginTop: '1.6rem', display: 'grid', gap: '0.9rem', background: 'rgba(255,255,255,0.04)' }}>
                <div>
                  <p className="eyebrow">Without Clock Out</p>
                  <p style={{ margin: '0.3rem 0 0' }}>
                    A typical biweekly payday: <b>{payday!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</b>, {days} days from now.
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Fee</p>
                  <p style={{ margin: '0.3rem 0 0' }}>
                    <b style={{ color: 'var(--paid)' }}>$0.00.</b> <span className="muted">Paycheck-advance apps charge $3.18 on average (CFPB).</span>
                  </p>
                </div>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: '1.4rem', lineHeight: 1.6 }}>
                Wallet {wallet?.address.slice(0, 6)}…{wallet?.address.slice(-4)} holds {wallet ? money(wallet.balance) : '…'} ·{' '}
                <a className="tx" href={`https://sepolia.basescan.org/tx/${shift.payTx}`} target="_blank" rel="noreferrer">the payment on BaseScan ↗</a>
              </p>
            </>
          )}
        </div>
      </div>
      <p className="muted" style={{ fontSize: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
        Testnet: paid in coUSD, a test dollar. Rosa is fictional.
      </p>
    </div>
  );
}

export default function MePage() {
  return (
    <Suspense>
      <Phone />
    </Suspense>
  );
}
