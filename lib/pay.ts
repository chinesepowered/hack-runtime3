import { RULES, type Night, type Shift } from './night';

export type StubLine = { label: string; amount: number; detail: string };
export type Check = { label: string; ok: boolean; detail: string; overridable?: boolean };

const HOUR = 3_600_000;
export const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / HOUR;
const cents = (x: number) => Math.round(x * 100) / 100;
export const money = (x: number) => `$${x.toFixed(2)}`;

export function duration(hours: number): string {
  const total = Math.round(Math.abs(hours) * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

/**
 * The pay stub for a shift ending at `clockOut`. Pure arithmetic from the
 * house rules — the agent shows every line before it pays.
 *
 *   wages       regular hours × rate, plus overtime past 8h at 1.5×
 *   FOH         + card tips on their tables − 20% tip-out to the kitchen
 *   BOH         + their share of the kitchen pool, by hours worked
 */
export function payStub(shift: Shift, night: Night, clockOut: string) {
  const hours = hoursBetween(shift.clockIn, clockOut);
  const overtime = Math.max(0, hours - RULES.overtimeAfterHours);
  const regular = hours - overtime;
  const lines: StubLine[] = [
    { label: 'Wages', amount: cents(regular * shift.rate), detail: `${duration(regular)} × ${money(shift.rate)}/hr` },
  ];
  if (overtime > 0) {
    lines.push({
      label: 'Overtime',
      amount: cents(overtime * shift.rate * RULES.overtimeMultiplier),
      detail: `${duration(overtime)} past ${RULES.overtimeAfterHours}h × ${money(shift.rate * RULES.overtimeMultiplier)}/hr`,
    });
  }
  let tipOut = 0;
  if (shift.side === 'FOH') {
    tipOut = cents((shift.cardTips * RULES.tipOutPct) / 100);
    lines.push({ label: 'Card tips', amount: shift.cardTips, detail: 'your tables tonight, from the POS' });
    lines.push({ label: 'Tip-out to the kitchen', amount: -tipOut, detail: `${RULES.tipOutPct}% of card tips — back of house gets tipped too` });
  } else {
    // Share of what the kitchen pool holds so far, by hours: actual hours for
    // anyone already out (including this shift), scheduled hours for anyone still on.
    const bohHours = night.shifts
      .filter(s => s.side === 'BOH')
      .reduce((sum, s) => {
        if (s.id === shift.id) return sum + hours;
        if (s.clockOut) return sum + hoursBetween(s.clockIn, s.clockOut);
        return sum + hoursBetween(s.scheduledStart, s.scheduledEnd);
      }, 0);
    const share = bohHours > 0 ? cents((night.kitchenPool * hours) / bohHours) : 0;
    lines.push({
      label: 'Kitchen tip pool',
      amount: share,
      detail: `${duration(hours)} of ${duration(bohHours)} kitchen hours × ${money(night.kitchenPool)} pooled so far`,
    });
  }
  const total = cents(lines.reduce((sum, l) => sum + l.amount, 0));
  return { hours, overtime, lines, total, tipOut };
}

/** What the agent verifies before paying. Failing an overridable check means "hold for a manager". */
export function checks(shift: Shift, clockOut: string, total: number, payrollUsd: number): Check[] {
  const lateBy = (Date.parse(shift.clockIn) - Date.parse(shift.scheduledStart)) / 60_000;
  const overrun = hoursBetween(shift.scheduledEnd, clockOut);
  return [
    {
      label: 'Clocked in on schedule',
      ok: Math.abs(lateBy) <= RULES.earlyLateMin,
      overridable: true,
      detail: `in at ${clock(shift.clockIn)} for a ${clock(shift.scheduledStart)} start (${lateBy >= 0 ? `${Math.round(lateBy)} min late` : `${Math.round(-lateBy)} min early`})`,
    },
    {
      label: 'Shift length matches the schedule',
      ok: overrun * 60 <= RULES.overrunMin,
      overridable: true,
      detail:
        overrun * 60 <= RULES.overrunMin
          ? `out at ${clock(clockOut)}, scheduled ${clock(shift.scheduledEnd)}`
          : `ran ${duration(overrun)} past the ${clock(shift.scheduledEnd)} schedule — overtime needs a manager's OK`,
    },
    { label: 'Not already paid tonight', ok: shift.status !== 'paid', detail: shift.status === 'paid' ? 'this shift was already paid' : 'first payout for this shift' },
    {
      label: `Under the ${money(RULES.capUsd)} per-shift cap`,
      ok: total <= RULES.capUsd,
      overridable: true,
      detail: `${money(total)} payout`,
    },
    { label: 'Payroll wallet can cover it', ok: payrollUsd >= total, detail: `payroll holds ${money(payrollUsd)}` },
  ];
}
