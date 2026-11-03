import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

export function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <article><section className="rounded-3xl bg-[#175b47] px-6 py-9 text-white sm:px-9"><p className="eyebrow text-[#cce8b7]">{eyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#d4e2da]">Last updated: November 3, 2026</p></section><div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={18}/><p><strong>Launch checklist:</strong> Before making Gather public, replace the legal entity name, mailing address, and privacy-rights email in these drafts, then have qualified counsel review them for the jurisdictions where you operate.</p></div></div><div className="legal-copy mt-10 space-y-9 text-[15px] leading-7 text-muted-foreground">{children}</div></article>;
}
export function LegalSection({ title, children }: { title: string; children: ReactNode }) { return <section><h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2><div className="mt-3 space-y-4">{children}</div></section>; }
export function LegalList({ items }: { items: ReactNode[] }) { return <ul className="list-disc space-y-2 pl-5">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>; }
