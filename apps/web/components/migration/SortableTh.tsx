'use client';

// Generic sortable column header. Each table picks its own SortField string
// union and provides a per-field default sort direction; the component just
// renders a clickable header and an arrow.

import { useCallback, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export function SortableTh<F extends string>({
  label,
  field,
  align = 'left',
  active,
  dir,
  onSort,
}: {
  label: string;
  field: F;
  align?: 'left' | 'right';
  active: F | null;
  dir: SortDir;
  onSort: (field: F) => void;
}) {
  const isActive = active === field;
  const arrow = isActive ? (dir === 'asc' ? '▲' : '▼') : '';
  const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th aria-sort={ariaSort} className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--foreground)] transition-colors ${
          isActive ? 'text-[var(--foreground)]' : ''
        }`}
      >
        <span>{label}</span>
        <span className="text-[10px] w-2 inline-block opacity-80">{arrow}</span>
      </button>
    </th>
  );
}

/** State + handler bundle for a sortable table. Pass the default field and
 *  the per-field default directions. Returns { field, dir, toggle } that you
 *  feed to SortableTh, plus a `compare` helper that you can use to sort an
 *  array if you wire up an extractor. */
export function useTableSort<F extends string>(
  defaultField: F,
  defaultDirs: Record<F, SortDir>,
) {
  const [field, setField] = useState<F>(defaultField);
  const [dir, setDir] = useState<SortDir>(defaultDirs[defaultField]);
  // No state setter inside another setter's updater: Strict Mode runs
  // updaters twice, which flipped the direction back.
  const toggle = useCallback(
    (f: F) => {
      if (f === field) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setField(f);
        setDir(defaultDirs[f]);
      }
    },
    [field, defaultDirs],
  );
  return { field, dir, toggle };
}
