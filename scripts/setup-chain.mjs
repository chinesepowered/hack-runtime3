#!/usr/bin/env node
/**
 * One-time chain setup on Base Sepolia: deploy the test dollar the restaurant
 * pays wages and tips in, and write its address to lib/deployments.json.
 * Idempotent: an existing deployment is reused.
 *
 *   pnpm setup:chain      (needs DEPLOYER_PRIVATE_KEY with a little Base Sepolia ETH)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const OUT = 'lib/deployments.json';
const TOKEN = JSON.parse(readFileSync('contracts/TestToken.json', 'utf8'));
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const pub = createPublicClient({ chain: baseSepolia, transport: http() });
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });

const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { chainId: 84532, tokens: {} };
if (!state.tokens.coUSD) {
  const hash = await wallet.deployContract({
    abi: TOKEN.abi,
    bytecode: TOKEN.bytecode,
    args: ['Clock Out Test Dollar (not real money)', 'coUSD', 6],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 90_000 });
  state.tokens.coUSD = { address: receipt.contractAddress, decimals: 6, name: 'Clock Out Test Dollar (not real money)' };
  writeFileSync(OUT, JSON.stringify(state, null, 2) + '\n');
  console.log(`deployed coUSD ${receipt.contractAddress}  ${hash}`);
} else {
  console.log(`coUSD already at ${state.tokens.coUSD.address}`);
}
