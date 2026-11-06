'use client';

// Small building blocks of the side panels.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { RESOURCE_ICONS } from './resourceIcons';
import { resColor } from './model';

export function Section(props: { title: string; hint?: string; count?: ReactNode; defaultOpen?: boolean; /** Opens the section whenever this turns true (the route panel opens when the route tool is picked). */ forceOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const [force, setForce] = useState(props.forceOpen ?? false);
  if ((props.forceOpen ?? false) !== force) {                       // the prop changed: adjust during render, no effect needed
    setForce(props.forceOpen ?? false);
    if (props.forceOpen) setOpen(true);
  }
  return (
    <section className="rokp-sec">
      <button type="button" className="rokp-sec-h" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="rokp-caret">{open ? '▾' : '▸'}</span>
        <span className="rokp-sec-t">{props.title}</span>
        {props.count !== undefined && <span className="rokp-badge">{props.count}</span>}
      </button>
      {open && (
        <div className="rokp-sec-b">
          {props.hint && <p className="rokp-hint">{props.hint}</p>}
          {props.children}
        </div>
      )}
    </section>
  );
}

export function Check(props: { checked: boolean; onChange(v: boolean): void; label: ReactNode; hint?: ReactNode; swatch?: string; disabled?: boolean }) {
  return (
    <label className={`rokp-check${props.disabled ? ' rokp-off' : ''}`}>
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      {props.swatch && <span className="rokp-sw" style={{ background: props.swatch }} />}
      <span className="rokp-check-t">
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
    </label>
  );
}

export function ResIcon(props: { name: string | undefined; code: number; size?: number }) {
  const svg = props.name ? RESOURCE_ICONS[props.name] : undefined;
  const size = props.size ?? 20;
  if (!svg) return <span className="rokp-dot" style={{ background: resColor(props.code), width: size * 0.7, height: size * 0.7 }} />;
  // a data: URI of our own SVG: next/image has nothing to optimise here
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width={size} height={size} alt="" className="rokp-icon" />;
}

export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function Seg<T extends string>(props: { value: T; options: { value: T; label: string; title?: string }[]; onChange(v: T): void }) {
  return (
    <div className="rokp-seg" role="group">
      {props.options.map((o) => (
        <button key={o.value} type="button" className={props.value === o.value ? 'on' : ''} title={o.title} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function fmtTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
