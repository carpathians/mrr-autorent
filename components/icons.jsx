'use client';
import React from 'react';

const base = 'w-5 h-5 shrink-0';

export function IconDashboard({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h7v7H4V5zm9 0h7v4h-7V5zM4 14h7v5H4v-5zm9-3h7v8h-7v-8z" />
    </svg>
  );
}

export function IconSearch({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="M16 16l4 4" />
    </svg>
  );
}

export function IconTag({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9h6v6l-9 9-6-6z" />
      <circle cx="16.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBot({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <path strokeLinecap="round" d="M12 8V5m-4 8h.01M16 13h.01M9 17h6" />
    </svg>
  );
}

export function IconBox({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinejoin="round" d="M3.5 8.5L12 4l8.5 4.5v9L12 22l-8.5-4.5v-9z" />
      <path strokeLinecap="round" d="M3.5 8.5L12 13l8.5-4.5M12 13v9" />
    </svg>
  );
}

export function IconList({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  );
}

export function IconChart({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 16V10m4 6V7m4 9v-4" />
    </svg>
  );
}

export function IconScroll({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h8a3 3 0 013 3v13H8a3 3 0 01-3-3V5a1 1 0 011-1z" />
      <path strokeLinecap="round" d="M10 9h6M10 13h6" />
    </svg>
  );
}

export function IconGear({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 3.5v2m0 13v2M4.9 6.5l1.4 1.4m11.4 11.2l1.4 1.4M3.5 12h2m13 0h2M4.9 17.5l1.4-1.4m11.4-11.2l1.4-1.4" />
    </svg>
  );
}

export function IconPick({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4l6 6M4 20l7-7m3-9a5 5 0 017 7" />
    </svg>
  );
}

export function IconMenu({ className = base }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
