'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard,
  IconSearch,
  IconTag,
  IconBot,
  IconBox,
  IconList,
  IconChart,
  IconScroll,
  IconGear,
  IconMenu,
} from './icons';

const links = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard },
  { to: '/browse', label: 'Browse Rigs', Icon: IconSearch },
  { to: '/deals', label: 'Good Deals', Icon: IconTag },
  { to: '/auto-rent', label: 'Auto Rent', Icon: IconBot },
  { to: '/my-rigs', label: 'My Rigs', Icon: IconBox },
  { to: '/rentals', label: 'Rentals', Icon: IconList },
  { to: '/profit', label: 'Profit', Icon: IconChart },
  { to: '/logs', label: 'Logs', Icon: IconScroll },
  { to: '/settings', label: 'Settings', Icon: IconGear },
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-dark-900 text-dark-100 relative">
      <div className="pointer-events-none fixed inset-0 bg-app-glow" aria-hidden="true" />

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden cursor-pointer"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static z-50 h-full w-60 shrink-0 border-r border-dark-400/80 bg-dark-800/95 backdrop-blur-md flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-dark-400/50">
          <div className="flex items-center gap-3">
            <img
              src="/icon.png"
              alt="MRR AutoRent"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl ring-1 ring-accent-teal/40 shadow-[0_0_18px_rgba(40,199,183,0.25)]"
            />
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">MRR AutoRent</h1>
              <span className="text-xs text-dark-300">Mining Rig Rentals</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" aria-label="Main">
          {links.map((l) => {
            const isActive = l.to === '/' ? pathname === '/' : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                href={l.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/50 ${
                  isActive
                    ? 'bg-accent-teal/10 text-accent-teal font-medium ring-1 ring-accent-teal/30'
                    : 'text-dark-200 hover:bg-dark-600/80 hover:text-white'
                }`}
              >
                <l.Icon className="w-5 h-5 opacity-90" />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-dark-400/80 text-xs text-dark-300">
          miningrigrentals.com
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-dark-400/50 bg-dark-800/90 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-dark-100 hover:bg-dark-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/50"
            aria-label="Open menu"
          >
            <IconMenu />
          </button>
          <img src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
          <span className="font-semibold text-white tracking-tight">MRR AutoRent</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
