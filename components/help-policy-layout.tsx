import { BookOpen, ChevronDown, ChevronRight, FileText, Headphones, Leaf } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type HelpPage = readonly [href: string, label: string];
type HelpGroup = { label: string; icon: LucideIcon; pages: readonly HelpPage[] };

const groups: readonly HelpGroup[] = [
  {
    label: 'Guides',
    icon: BookOpen,
    pages: [
      ['/help', 'Help Center'],
      ['/help/organizers', 'Organizer Guide'],
      ['/help/bidders', 'Bidder Guide'],
      ['/help/fees', 'Fees & Payments'],
      ['/help/travel', 'Travel Experiences'],
    ],
  },
  {
    label: 'Policies',
    icon: FileText,
    pages: [
      ['/legal/privacy', 'Privacy Policy'],
      ['/legal/terms', 'Terms of Service'],
      ['/legal/cookies', 'Cookie Policy'],
      ['/legal/refunds', 'Refunds & Fulfillment'],
    ],
  },
  {
    label: 'Support',
    icon: Headphones,
    pages: [['/support', 'Contact Support']],
  },
];

const pages = groups.flatMap(group => group.pages);

export function HelpPolicyLayout({ active, title, lede, status, children }: { active: string; title: string; lede: string; status?: string; children: ReactNode }) {
  const currentLabel = pages.find(([href]) => href === active)?.[1] || 'Help & policies';
  return <main className="min-h-screen bg-[#f4f7f5] text-[#22352e]">
    <header className="border-b border-[#dce4df] bg-white">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <a href="/" className="flex items-center gap-2 text-xl font-semibold text-[#175b47]" aria-label="Gather home"><span className="grid size-9 place-items-center rounded-full bg-[#e5efe9]"><Leaf size={18}/></span>gather<span className="-ml-2 text-[#78a68b]">.</span></a>
        <div className="flex items-center gap-2"><a href="/help" className="hidden min-h-11 items-center px-4 text-sm font-semibold text-[#536b60] hover:text-[#175b47] sm:inline-flex">Help Center</a><a href="/support" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#175b47] px-5 text-sm font-semibold text-white hover:bg-[#104735]">Contact support</a></div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10 lg:py-12">
      <details className="group mb-6 rounded-2xl border border-[#dce4df] bg-white shadow-sm lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-semibold text-[#175b47]"><span>{currentLabel}</span><ChevronDown className="transition group-open:rotate-180" size={18}/></summary>
        <div className="border-t border-[#e4eae6] p-3"><Navigation active={active}/></div>
      </details>

      <div className="grid items-start gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
        <aside className="sticky top-6 hidden rounded-2xl border border-[#dce4df] bg-white p-4 shadow-sm lg:block"><p className="px-3 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#75877e]">Help & information</p><Navigation active={active}/></aside>

        <article className="min-w-0 rounded-3xl border border-[#dfe7e2] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-11 lg:px-14 lg:py-13 [&_a]:font-medium [&_a]:text-[#176247] [&_a]:underline [&_a]:decoration-[#b8d0c2] [&_a]:underline-offset-4 hover:[&_a]:decoration-[#176247] [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-[#193d30] [&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#25483a] [&_li]:my-2.5 [&_li]:pl-1 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:mb-5 [&_p]:max-w-3xl [&_p]:leading-7 [&_ul]:ml-6 [&_ul]:list-disc">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#2f765b]">Gather help & policies</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-[#193d30] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#63736a]">{lede}</p>
          {status && <p className="mt-5 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-[#7b5d16]">{status}</p>}
          <div className="mt-9 border-t border-[#e6ece8] pt-1">{children}</div>
        </article>
      </div>
    </div>

    <footer className="border-t border-[#dce4df] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-[#718078] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span>Gather · Simple online auctions for nonprofits.</span><div className="flex flex-wrap gap-5"><a href="/about/give-holidays" className="hover:text-[#175b47]">About Give Holidays</a><a href="/help" className="hover:text-[#175b47]">Help Center</a><a href="/legal/privacy" className="hover:text-[#175b47]">Privacy</a><a href="/legal/terms" className="hover:text-[#175b47]">Terms</a><a href="/support" className="hover:text-[#175b47]">Support</a></div></div></footer>
  </main>;
}

function Navigation({ active }: { active: string }) {
  return <nav aria-label="Help and policies" className="space-y-5">{groups.map(group => { const Icon = group.icon; return <section key={group.label}><div className="mb-1.5 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8b82]"><Icon size={14}/>{group.label}</div><div className="space-y-1">{group.pages.map(([href, label]) => <a key={href} href={href} aria-current={active === href ? 'page' : undefined} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition ${active === href ? 'bg-[#e5efe9] font-semibold text-[#175b47]' : 'text-[#53675d] hover:bg-[#f3f7f4] hover:text-[#175b47]'}`}><span>{label}</span><ChevronRight size={15} className={active === href ? 'opacity-100' : 'opacity-0'}/></a>)}</div></section>; })}</nav>;
}

export function ReviewNotice() {
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="!mt-0 text-xl font-semibold">Final review in progress</h2><p className="!mb-0">This policy is being reviewed for the production launch. Contact <a href="mailto:support@gatherforgood.bid">support@gatherforgood.bid</a> if you need assistance before the final policy is published.</p></div>;
}
