import { NextResponse } from 'next/server';
import { erc20Abi, formatUnits } from 'viem';
import { COUSD, publicClient, workerAddress } from '@/lib/chain';
import { readNight, RULES } from '@/lib/night';
import { canSign, payrollAddress, SIGNER_SUPPORTED } from '@/lib/signer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const usd = async (address: `0x${string}`) =>
  Number(formatUnits(await publicClient.readContract({ address: COUSD.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] }), COUSD.decimals));

export async function GET() {
  const night = await readNight();
  const payroll = payrollAddress();
  const [payrollUsd, wallets] = await Promise.all([
    payroll ? usd(payroll) : 0,
    Promise.all(night.shifts.map(async s => ({ id: s.id, address: workerAddress(s.id), balance: await usd(workerAddress(s.id)) }))),
  ]);
  return NextResponse.json({
    night,
    rules: RULES,
    payroll: { address: payroll, usd: payrollUsd },
    wallets,
    live: { canSign: canSign(), signerSupported: SIGNER_SUPPORTED },
  });
}
