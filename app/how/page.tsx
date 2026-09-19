import { addressUrl, COUSD, workerAddress } from '@/lib/chain';
import { RULES } from '@/lib/night';
import { canSign, payrollAddress } from '@/lib/signer';

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '1', title: 'Clock out', body: 'The worker taps out. That is the only thing they do.', tech: 'POST /api/clockout' },
  { n: '2', title: 'Verify', body: `On schedule? Within ${RULES.overrunMin} minutes of the planned end? Not already paid? Under the $${RULES.capUsd} cap? Payroll can cover it?`, tech: 'lib/pay.ts · checks()' },
  { n: '3', title: 'Build the stub', body: `Wages, overtime past ${RULES.overtimeAfterHours}h at ${RULES.overtimeMultiplier}×, card tips, and a ${RULES.tipOutPct}% tip-out that goes to the kitchen by hours worked.`, tech: 'lib/pay.ts · payStub()' },
  { n: '4', title: 'Pay or hold', body: 'All clear: the payroll wallet pays now. Anything off: held with a reason, until a manager approves.', tech: 'Dynamic server wallet · lib/agent.ts' },
];

export default function HowPage() {
  const payroll = payrollAddress();
  const live = canSign();
  const rows = [
    { what: 'Payroll wallet signing', live, text: live ? 'Live — Dynamic server wallet' : 'Unavailable on this server' },
    { what: 'Payouts', live, text: live ? 'Live — coUSD transfers on Base Sepolia' : 'Decisions only' },
    { what: 'Shifts and tips', live: false, text: 'Seeded — a fictional night, POS totals included' },
    { what: 'The money', live: false, text: 'Test dollars (coUSD), not real money' },
  ];

  return (
    <div className="page">
      <p className="eyebrow">How it works</p>
      <h1 className="headline" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', margin: '0.5rem 0 0.9rem' }}>
        Payroll that runs at clock-out.
      </h1>
      <p className="muted" style={{ maxWidth: '42rem', lineHeight: 1.65, marginBottom: '2.4rem' }}>
        The money is already earned when the shift ends. The only reason it waits two weeks is that payroll runs in batches.
        Here an agent settles each shift the moment it ends — and says no, with a reason, when something doesn&apos;t add up.
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}>
        {STEPS.map(s => (
          <li key={s.n} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <span className="mono" style={{ fontSize: '1.9rem', color: 'var(--punch)', fontWeight: 700 }}>{s.n}</span>
            <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 800 }}>{s.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.55, flex: 1 }}>{s.body}</p>
            <p className="mono" style={{ margin: 0, color: 'var(--paid)', fontSize: '0.78rem' }}>{s.tech}</p>
          </li>
        ))}
      </ol>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 1rem' }}>What is live in this build</h2>
      <div className="panel" style={{ padding: 0, marginBottom: '2.5rem' }}>
        {rows.map((r, i) => (
          <div key={r.what} data-testid="status-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.95rem 1.25rem', borderTop: i ? '1px solid var(--line)' : 'none', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{r.what}</span>
            <span className={`chip ${r.live ? 'live' : ''}`}><span className="dot" />{r.text}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 1rem' }}>On-chain</h2>
      <div className="panel" style={{ display: 'grid', gap: '0.55rem', fontSize: '0.88rem' }}>
        {payroll && <div>Payroll wallet (Dynamic): <a className="tx" href={addressUrl(payroll)} target="_blank" rel="noreferrer">{payroll}</a></div>}
        <div>coUSD test dollar: <a className="tx" href={addressUrl(COUSD.address)} target="_blank" rel="noreferrer">{COUSD.address}</a></div>
        {['rosa', 'dev', 'theo', 'kemi'].map(id => (
          <div key={id} className="muted">
            {id[0].toUpperCase() + id.slice(1)}&apos;s wallet: <a className="tx" href={addressUrl(workerAddress(id))} target="_blank" rel="noreferrer">{workerAddress(id)}</a>
          </div>
        ))}
        <p className="muted" style={{ margin: '0.6rem 0 0', fontSize: '0.8rem' }}>
          Base Sepolia testnet. Demo worker wallets are addresses derived from their names — no one holds their keys, and they only ever receive test dollars.
        </p>
      </div>
    </div>
  );
}
