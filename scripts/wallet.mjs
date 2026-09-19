#!/usr/bin/env node
/**
 * The restaurant's payroll wallet: a Dynamic server wallet the agent pays from.
 *
 *   pnpm wallet create   create it (Linux/macOS only: Dynamic's MPC signer)
 *   pnpm wallet fund     deposit test dollars and gas (uses the deployer key)
 *   pnpm wallet status   balances
 *
 * `create` writes the password and metadata into .env itself; nothing secret is printed.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, erc20Abi, formatEther, formatUnits, http, parseAbi, parseEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const d = JSON.parse(readFileSync('lib/deployments.json', 'utf8'));
const pub = createPublicClient({ chain: baseSepolia, transport: http() });
const die = m => { console.error(`\n  ${m}\n`); process.exit(1); };

function writeEnv(updates, file = '.env') {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, () => line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  writeFileSync(file, text);
}

const payroll = () => {
  if (!process.env.PAYROLL_WALLET_METADATA) die('No PAYROLL_WALLET_METADATA in .env. Run `pnpm wallet create` first.');
  return JSON.parse(process.env.PAYROLL_WALLET_METADATA).accountAddress;
};

async function create() {
  if (process.env.PAYROLL_WALLET_METADATA) die('.env already has PAYROLL_WALLET_METADATA; refusing to replace a wallet that may hold funds.');
  const { DynamicEvmWalletClient } = await import('@dynamic-labs-wallet/node-evm');
  const client = new DynamicEvmWalletClient({ environmentId: process.env.DYNAMIC_ENV_ID });
  await client.authenticateApiToken(process.env.DYNAMIC_API_TOKEN);
  const password = randomBytes(24).toString('hex');
  const { walletMetadata } = await client.createWalletAccount({ thresholdSignatureScheme: 'TWO_OF_TWO', password, backUpToDynamic: true });
  writeEnv({ PAYROLL_WALLET_PASSWORD: password, PAYROLL_WALLET_METADATA: JSON.stringify(walletMetadata) });
  console.log(`payroll wallet: ${walletMetadata.accountAddress} (password and metadata saved to .env)`);
}

async function fund(usd = '5000', eth = '0.001') {
  const to = payroll();
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });
  let h = await wallet.writeContract({ address: d.tokens.coUSD.address, abi: parseAbi(['function mint(address,uint256)']), functionName: 'mint', args: [to, parseUnits(usd, 6)] });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`deposited ${usd} coUSD → ${to}  ${h}`);
  h = await wallet.sendTransaction({ to, value: parseEther(eth) });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`sent ${eth} ETH gas → ${to}  ${h}`);
}

async function status() {
  const who = payroll();
  const bal = await pub.readContract({ address: d.tokens.coUSD.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] });
  console.log(`payroll wallet ${who}\n  ETH   ${formatEther(await pub.getBalance({ address: who }))}\n  coUSD ${formatUnits(bal, 6)}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'create') await create();
else if (cmd === 'fund') await fund(...args);
else if (cmd === 'status') await status();
else die('usage: pnpm wallet create | fund [usd] [eth] | status');
