import { encodeFunctionData, erc20Abi, formatUnits, parseUnits, type Hex } from 'viem';
import { COUSD, publicClient, txUrl, workerAddress } from './chain';
import { readNight, writeNight } from './night';
import { checks, payStub, type Check, type StubLine } from './pay';
import { canSign, payrollAddress, sendFromPayroll } from './signer';

/** Everything the agent does for one clock-out, streamed to the shift board. */
export type AgentEvent =
  | { type: 'clockout'; name: string; at: string; approved: boolean }
  | { type: 'check'; check: Check; approved: boolean }
  | { type: 'line'; line: StubLine }
  | { type: 'total'; amount: number }
  | { type: 'hold'; name: string; reason: string; amount: number }
  | { type: 'pay'; name: string; amount: number; to: Hex; hash: string; url: string; ok: boolean; at: string }
  | { type: 'unavailable'; reason: string }
  | { type: 'error'; message: string };

async function payrollBalanceUsd(): Promise<number> {
  const who = payrollAddress();
  if (!who) return 0;
  const raw = await publicClient.readContract({ address: COUSD.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] });
  return Number(formatUnits(raw, COUSD.decimals));
}

/**
 * A worker clocks out (or a manager approves a held shift). The agent
 * verifies the shift, builds the pay stub, and either pays the worker from the
 * Dynamic payroll wallet immediately or holds it with a reason.
 */
export async function* settleShift(id: string, managerApproval = false): AsyncGenerator<AgentEvent> {
  const night = await readNight();
  const shift = night.shifts.find(s => s.id === id);
  if (!shift) {
    yield { type: 'error', message: 'No such shift tonight.' };
    return;
  }
  if (shift.status === 'paid') {
    yield { type: 'error', message: `${shift.name} was already paid tonight.` };
    return;
  }
  if (managerApproval && shift.status !== 'held') {
    yield { type: 'error', message: `${shift.name}'s shift isn't waiting on a manager.` };
    return;
  }

  const clockOut = shift.clockOut ?? new Date().toISOString();
  shift.clockOut = clockOut;
  yield { type: 'clockout', name: shift.name, at: clockOut, approved: managerApproval };

  // 1. Verify.
  const stub = payStub(shift, night, clockOut);
  const verdicts = checks(shift, clockOut, stub.total, await payrollBalanceUsd());
  for (const c of verdicts) yield { type: 'check', check: c, approved: managerApproval && !c.ok && !!c.overridable };

  // 2. Build the stub.
  for (const line of stub.lines) yield { type: 'line', line };
  yield { type: 'total', amount: stub.total };

  // 3. Decide. A manager can clear an overridable check, never a hard one.
  const blocking = verdicts.filter(c => !c.ok && !(managerApproval && c.overridable));
  if (blocking.length) {
    const hard = blocking.find(c => !c.overridable);
    shift.status = 'held';
    shift.holdReason = (hard ?? blocking[0]).detail;
    await writeNight(night);
    yield { type: 'hold', name: shift.name, reason: shift.holdReason, amount: stub.total };
    return;
  }

  // 4. Pay, from the Dynamic payroll wallet, straight to the worker.
  if (!canSign()) {
    await writeNight(night);
    yield { type: 'unavailable', reason: "This server can't sign with Dynamic's payroll wallet here (its signer runs on Linux and macOS), so nothing was paid." };
    return;
  }
  const to = workerAddress(shift.id);
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, parseUnits(stub.total.toFixed(2), COUSD.decimals)] });
  const { hash, ok } = await sendFromPayroll({ to: COUSD.address, data });
  const paidAt = new Date().toISOString();
  if (ok) {
    shift.status = 'paid';
    shift.paidUsd = stub.total;
    shift.payTx = hash;
    shift.paidAt = paidAt;
    shift.approvedByManager = managerApproval;
    shift.holdReason = undefined;
    night.kitchenPool = Math.round((night.kitchenPool + stub.tipOut) * 100) / 100;
  }
  await writeNight(night);
  yield { type: 'pay', name: shift.name, amount: stub.total, to, hash, url: txUrl(hash), ok, at: paidAt };
}
