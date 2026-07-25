import React from 'react';

const BAR = 'h-3 rounded bg-dark-500 animate-pulse';

/** Skeleton table rows while list/details load */
export default function TableSkeleton({ rows = 8, cols = 8 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={`sk-${r}`} className="border-b border-dark-600">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-3 py-3">
          <div
            className={`${BAR} ${
              c === 0 ? 'w-36' : c === cols - 1 ? 'w-14 ml-auto' : 'w-16'
            }`}
          />
        </td>
      ))}
    </tr>
  ));
}

/** Inline cell skeleton for a single pending detail */
export function SkeletonBar({ className = 'w-16' }) {
  return <div className={`${BAR} ${className}`} />;
}
