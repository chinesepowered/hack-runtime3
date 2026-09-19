import { NextResponse } from 'next/server';
import { createWalletClient, erc20Abi, formatUnits, http, parseAbi, parseUnits, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { COUSD, publicClient } from '@/lib/chain';
import { seedNight, writeNight } from '@/lib/night';
import { payrollAddress } from '@/lib/signer';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Start a fresh night (demo). If the payroll wallet is running low, the
 * deployer mints it more test dollars, so the public demo keeps working.
 */
let lastReset = 0;
export async function POST() {
  if (Date.now() - lastReset < 20_000) return NextResponse.json({ error: 'A new night just started — give it a moment.' }, { status: 429 });
  lastReset = Date.now();
  await writeNight(seedNight());

  const payroll = payrollAddress();
  const key = process.env.DEPLOYER_PRIVATE_KEY ?? '';
  if (payroll && /^0x[0-9a-fA-F]{64}$/.test(key)) {
    const bal = Number(formatUnits(await publicClient.readContract({ address: COUSD.address, abi: erc20Abi, functionName: 'balanceOf', args: [payroll] }), COUSD.decimals));
    if (bal < 1500) {
      const wallet = createWalletClient({ account: privateKeyToAccount(key as Hex), chain: baseSepolia, transport: http() });
      const hash = await wallet.writeContract({ address: COUSD.address, abi: parseAbi(['function mint(address,uint256)']), functionName: 'mint', args: [payroll, parseUnits('3000', COUSD.decimals)] });
      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    }
  }
  return NextResponse.json({ ok: true });
}
