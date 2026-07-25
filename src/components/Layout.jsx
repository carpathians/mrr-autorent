import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/browse', label: 'Browse Rigs', icon: '🔍' },
  { to: '/deals', label: 'Good Deals', icon: '🏷' },
  { to: '/auto-rent', label: 'Auto Rent', icon: '🤖' },
  { to: '/my-rigs', label: 'My Rigs', icon: '📦' },
  { to: '/rentals', label: 'Rentals', icon: '📋' },
  { to: '/profit', label: 'Profit', icon: '💰' },
  { to: '/logs', label: 'Logs', icon: '📜' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-dark-900 text-gray-100">
      <aside className="w-56 bg-dark-800 border-r border-dark-400 flex flex-col">
        <div className="p-4 border-b border-dark-400">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛏</span>
            <div>
              <h1 className="text-base font-bold text-white">MRR AutoRent</h1>
              <span className="text-xs text-dark-200">SHA256 Asicboost</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-dark-500 text-white font-medium'
                    : 'text-dark-200 hover:bg-dark-600 hover:text-white'
                }`
              }
            >
              <span className="text-base">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-400 text-xs text-dark-300">
          miningrigrentals.com
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
