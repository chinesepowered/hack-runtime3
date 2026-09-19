import { createPublicClient, http, keccak256, toBytes, getAddress, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import deployments from './deployments.json';

type Deployments = { chainId: number; tokens: Record<string, { address: Hex; decimals: number; name: string }> };

/** Written by scripts/setup-chain.mjs. Public on-chain data. */
export const D = deployments as unknown as Deployments;
export const COUSD = D.tokens.coUSD;

export const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
export const txUrl = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`;
export const addressUrl = (address: string) => `https://sepolia.basescan.org/address/${address}`;

/**
 * A demo worker's payout address, derived from their name. No private key
 * exists for it — it only ever receives test dollars — so a fictional worker
 * has a stable, inspectable wallet without anyone holding their keys.
 */
export function workerAddress(id: string): Hex {
  return getAddress(`0x${keccak256(toBytes(`clock-out:worker:${id}`)).slice(-40)}`);
}
