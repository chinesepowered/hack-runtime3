import { isAddress, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { publicClient } from './chain';

/**
 * Dynamic wallet pattern: SERVER WALLET.
 *
 * The restaurant's payroll wallet is a Dynamic server wallet owned by the
 * app's developer account; the agent authenticates with an API token and
 * signs with the wallet's password (2-of-2 MPC, key shares backed up to
 * Dynamic — no raw private key on the server). The agent can only do one
 * thing with it: pay a verified shift to that worker's address.
 *
 * Dynamic's MPC signer ships native binaries for Linux and macOS only; on any
 * other platform the app reports signing as unavailable instead of pretending.
 */
const ENV_ID = process.env.DYNAMIC_ENV_ID ?? '';
const API_TOKEN = process.env.DYNAMIC_API_TOKEN ?? '';
const PASSWORD = process.env.PAYROLL_WALLET_PASSWORD ?? '';
const METADATA = process.env.PAYROLL_WALLET_METADATA ?? '';

export const SIGNER_SUPPORTED = process.platform === 'linux' || process.platform === 'darwin';

type WalletMetadata = { accountAddress: string } & Record<string, unknown>;

export function payrollAddress(): Hex | null {
  try {
    const a = (JSON.parse(METADATA) as WalletMetadata).accountAddress;
    return isAddress(a) ? (a as Hex) : null;
  } catch {
    return null;
  }
}

export const canSign = (): boolean =>
  SIGNER_SUPPORTED && ENV_ID !== '' && API_TOKEN !== '' && PASSWORD !== '' && payrollAddress() !== null;

type EvmClient = {
  authenticateApiToken: (token: string) => Promise<void>;
  signTransaction: (a: { walletMetadata: WalletMetadata; transaction: Record<string, unknown>; password?: string }) => Promise<string>;
};
let clientPromise: Promise<EvmClient> | null = null;

async function dynamic(): Promise<EvmClient> {
  clientPromise ??= (async () => {
    const mod = (await import('@dynamic-labs-wallet/node-evm')) as unknown as {
      DynamicEvmWalletClient: new (o: { environmentId: string }) => EvmClient;
    };
    const client = new mod.DynamicEvmWalletClient({ environmentId: ENV_ID });
    await client.authenticateApiToken(API_TOKEN);
    return client;
  })().catch(err => {
    clientPromise = null;
    throw err;
  });
  return clientPromise;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Sign with the payroll wallet, broadcast, and wait for the receipt. Gas
 * estimation is retried because the public RPC is load-balanced and a node a
 * block behind can briefly disagree about balances.
 */
export async function sendFromPayroll(tx: { to: Hex; data: Hex }): Promise<{ hash: Hex; ok: boolean }> {
  if (!canSign()) throw new Error('Signing is unavailable in this environment.');
  const from = payrollAddress()!;
  let gas = 0n;
  for (let attempt = 1; ; attempt++) {
    try {
      gas = await publicClient.estimateGas({ account: from, to: tx.to, data: tx.data });
      break;
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(2500);
    }
  }
  const [nonce, fees] = await Promise.all([
    publicClient.getTransactionCount({ address: from, blockTag: 'pending' }),
    publicClient.estimateFeesPerGas(),
  ]);
  const signed = (await (await dynamic()).signTransaction({
    walletMetadata: JSON.parse(METADATA) as WalletMetadata,
    password: PASSWORD,
    transaction: {
      type: 'eip1559',
      chainId: baseSepolia.id,
      to: tx.to,
      data: tx.data,
      value: 0n,
      nonce,
      gas: (gas * 13n) / 10n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    },
  })) as Hex;
  const hash = await publicClient.sendRawTransaction({ serializedTransaction: signed });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  return { hash, ok: receipt.status === 'success' };
}
