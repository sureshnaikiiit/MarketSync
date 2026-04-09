'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const TABS = [
  { href: '/us',     label: 'US Market'     },
  { href: '/india',  label: 'India Market'  },
];

interface NavBarProps {
  /** Optional slot rendered on the right (e.g. ConnectionBadge) */
  actions?: ReactNode;
}

export default function NavBar({ actions }: NavBarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        {/* Logo + tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
              <span className="text-sm font-bold text-emerald-400">M</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">MarketSync</span>
          </div>

          <nav className="flex items-center gap-1">
            {TABS.map(tab => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right slot */}
        {actions && <div>{actions}</div>}
      </div>
    </header>
  );
}
