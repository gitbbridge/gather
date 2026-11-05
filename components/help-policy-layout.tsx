import { Leaf } from 'lucide-react';
import type { ReactNode } from 'react';

const pages = [
  ['/help', 'Help Center'],
  ['/help/organizers', 'Organizer Guide'],
  ['/help/bidders', 'Bidder Guide'],
  ['/help/fees', 'Fees & Payments'],
  ['/help/travel', 'Travel Experiences'],
  ['/legal/privacy', 'Privacy Policy'],
  ['/legal/terms', 'Terms of Service'],
  ['/legal/cookies', 'Cookie Policy'],
  ['/legal/refunds', 'Refunds & Fulfillment'],
  ['/support', 'Contact Support'],
] as const;

export function HelpPolicyLayout({ active, title, lede, status, children }: { active: string; title: string; lede: string; status?: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#f6f8f6] text-[#22352e]">
    <header className="border-b border-[#dce4df] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-2 text-xl font-semibold text-[#175b47]"><Leaf size={20}/>gather<span className="text-[#78a68b]">.</span></a>
        <a href="/support" className="text-sm font-semibold text-[#175b47] hover:underline">Contact support</a>
      </div>
    </header>
    <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-12">
      <nav aria-label="Help and policies" className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-6 lg:flex-col lg:self-start lg:overflow-visible lg:pb-0">
        <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#829087] lg:block">Help &amp; policies</p>
        {pages.map(([href, label]) => <a key={href} href={href} aria-current={active === href ? 'page' : undefined} className={`block shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors ${active === href ? 'bg-[#e5efe9] font-semibold text-[#175b47]' : 'text-[#586b62] hover:bg-white hover:text-[#175b47]'}`}>{label}</a>)}
      </nav>
      <article className="min-w-0 rounded-2xl border border-[#dfe7e2] bg-white p-6 shadow-sm sm:p-10 lg:p-12 [&_a]:font-medium [&_a]:text-[#175b47] [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:mb-4 [&_p]:leading-7 [&_ul]:ml-6 [&_ul]:list-disc">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#193d30]">{title}</h1>
        <p className="mt-3 text-lg leading-8 text-[#63736a]">{lede}</p>
        {status && <p className="mt-4 text-sm font-medium text-[#7b6a3f]">{status}</p>}
        <div className="mt-8">{children}</div>
      </article>
    </div>
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t px-5 py-7 text-xs text-[#718078] sm:px-8">
      <span>Gather · Good auctions, made simple.</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <a href="/about/give-holidays" className="hover:text-[#175b47]">About Give Holidays</a>
        <a href="/help" className="hover:text-[#175b47]">Help Center</a>
        <a href="/legal/privacy" className="hover:text-[#175b47]">Privacy</a>
        <a href="/legal/terms" className="hover:text-[#175b47]">Terms</a>
        <a href="/support" className="hover:text-[#175b47]">Support</a>
      </div>
    </footer>
  </main>;
}

export function ReviewNotice() {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="!mt-0 text-xl font-semibold">Final review in progress</h2><p className="!mb-0">This policy is being reviewed for the production launch. Contact <a href="mailto:support@gatherforgood.bid">support@gatherforgood.bid</a> if you need assistance before the final policy is published.</p></div>;
}
