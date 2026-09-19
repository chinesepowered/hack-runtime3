import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clock Out — get paid when your shift ends',
  description:
    'An agent checks each clock-out against the schedule, splits the tip pool, and pays the shift instantly from a Dynamic payroll wallet. Base Sepolia testnet.',
};

function PunchClock() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#ffd34e" strokeWidth="2" />
      <path d="M12 6.5V12l3.6 2.2" stroke="#eef2f8" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">
            <PunchClock />
            Clock Out
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/">Tonight</Link>
          <Link href="/me?w=rosa">Rosa&apos;s phone</Link>
          <Link href="/how">How it works</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
