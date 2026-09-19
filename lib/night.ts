import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Tonight at Lucía's (fictional). Shifts are seeded relative to when the night
 * starts, so the demo reads the same whenever it runs: Rosa's shift ends now,
 * Theo and Kemi are still working, and Dev's ran long.
 *
 * State lives in a JSON file (/tmp on Vercel: per-instance and ephemeral, so
 * a cold start begins a fresh night). Payments themselves are on-chain.
 */
export type Side = 'FOH' | 'BOH';
export type Shift = {
  id: string;
  name: string;
  role: string;
  side: Side;
  rate: number; // $/hour
  scheduledStart: string;
  scheduledEnd: string;
  clockIn: string;
  clockOut?: string;
  cardTips: number; // tonight's card tips on this person's tables (FOH), from the POS
  status: 'working' | 'held' | 'paid';
  holdReason?: string;
  paidUsd?: number;
  payTx?: string;
  paidAt?: string;
  approvedByManager?: boolean;
};
export type Night = {
  restaurant: string;
  startedAt: string;
  kitchenPool: number; // tip-outs received from front of house so far tonight
  shifts: Shift[];
};

/** House rules, shown in the UI and enforced by the agent. */
export const RULES = {
  tipOutPct: 20, // front of house tips out this share of card tips to the kitchen
  earlyLateMin: 15, // clock-in must be within this many minutes of schedule
  overrunMin: 90, // a shift this far past schedule needs a manager
  capUsd: 600, // no single payout above this without a manager
  overtimeAfterHours: 8, // daily overtime threshold
  overtimeMultiplier: 1.5,
};

const H = 3_600_000;
const M = 60_000;

export function seedNight(now = Date.now()): Night {
  const at = (ms: number) => new Date(now + ms).toISOString();
  return {
    restaurant: 'Lucía’s',
    startedAt: at(0),
    kitchenPool: 0,
    shifts: [
      { id: 'rosa', name: 'Rosa', role: 'Server', side: 'FOH', rate: 17, scheduledStart: at(-6 * H), scheduledEnd: at(0), clockIn: at(-6 * H - 2 * M), cardTips: 164.5, status: 'working' },
      { id: 'dev', name: 'Dev', role: 'Line cook', side: 'BOH', rate: 21, scheduledStart: at(-8.5 * H), scheduledEnd: at(-2.5 * H), clockIn: at(-8.5 * H + 1 * M), cardTips: 0, status: 'working' },
      { id: 'theo', name: 'Theo', role: 'Bartender', side: 'FOH', rate: 16, scheduledStart: at(-5 * H), scheduledEnd: at(1 * H), clockIn: at(-5 * H + 3 * M), cardTips: 212, status: 'working' },
      { id: 'kemi', name: 'Kemi', role: 'Dishwasher', side: 'BOH', rate: 18, scheduledStart: at(-6 * H), scheduledEnd: at(0.5 * H), clockIn: at(-6 * H - 4 * M), cardTips: 0, status: 'working' },
    ],
  };
}

const dataDir = () => (process.env.VERCEL ? '/tmp/clock-out' : path.join(process.cwd(), '.data'));
const file = () => path.join(dataDir(), 'night.json');

export async function readNight(): Promise<Night> {
  try {
    return JSON.parse(await readFile(file(), 'utf8')) as Night;
  } catch {
    const night = seedNight();
    await writeNight(night);
    return night;
  }
}

export async function writeNight(night: Night): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(file(), JSON.stringify(night, null, 2), 'utf8');
}
