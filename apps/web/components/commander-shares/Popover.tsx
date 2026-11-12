'use client';

// One popover for the whole page, like the reference: hover or focus shows it, a click / tap pins it (click again or anywhere else to close),
// moving the mouse into it keeps it open. Content is React nodes (player texts are escaped by React).

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import s from './SharedCommanders.module.css';

type Open = { anchor: HTMLElement; content: ReactNode; pinned: boolean };

type Api = {
  show: (anchor: HTMLElement, content: ReactNode) => void;
  toggle: (anchor: HTMLElement, content: ReactNode) => void;
  leave: () => void;
  close: () => void;
};

const PopCtx = createContext<Api | null>(null);

export function PopoverHost({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);

  const stop = () => window.clearTimeout(timer.current);

  const api = useMemo<Api>(
    () => ({
      show: (anchor, content) => {
        stop();
        setOpen((o) => (o?.pinned ? o : { anchor, content, pinned: false }));
      },
      toggle: (anchor, content) => {
        stop();
        setOpen((o) => (o?.pinned && o.anchor === anchor ? null : { anchor, content, pinned: true }));
      },
      leave: () => {
        stop();
        timer.current = window.setTimeout(() => setOpen((o) => (o?.pinned ? o : null)), 250);
      },
      close: () => {
        stop();
        setOpen(null);
      },
    }),
    [],
  );

  // Place it next to the anchor (right, else left, else centred), inside the window: measured and moved before the browser paints.
  useLayoutEffect(() => {
    const el = box.current;
    if (!open || !el) return;
    const r = open.anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = r.right + 8;
    let y = r.top;
    if (x + w > window.innerWidth - 8) x = r.left - w - 8;
    if (x < 8) x = Math.max(8, (window.innerWidth - w) / 2);
    if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
    el.style.left = `${x + window.scrollX}px`;
    el.style.top = `${y + window.scrollY}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => api.close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && api.close();
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    // A card can be replaced by a live update: drop a popover whose anchor left the page.
    const gone = window.setInterval(() => !open.anchor.isConnected && api.close(), 1000);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearInterval(gone);
    };
  }, [open, api]);

  useEffect(() => () => stop(), []);

  return (
    <PopCtx.Provider value={api}>
      <div className={className}>
        {children}
        {open &&
          createPortal(
            <div className={s.page}>
              <div
                ref={box}
                className={s.pop}
                role="dialog"
                onMouseEnter={stop}
                onMouseLeave={api.leave}
                onClick={(e) => e.stopPropagation()}
              >
                {open.content}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </PopCtx.Provider>
  );
}

/** Props for an element that opens a popover. */
export function usePopover(make: () => ReactNode) {
  const api = useContext(PopCtx);
  if (!api) throw new Error('usePopover needs a PopoverHost');
  return {
    tabIndex: 0,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => api.show(e.currentTarget, make()),
    onMouseLeave: api.leave,
    onFocus: (e: React.FocusEvent<HTMLElement>) => api.show(e.currentTarget, make()),
    onBlur: api.leave,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      api.toggle(e.currentTarget, make());
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        api.toggle(e.currentTarget, make());
      }
    },
  };
}
