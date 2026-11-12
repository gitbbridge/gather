import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  Compass,
  CreditCard,
  Gavel,
  LayoutTemplate,
  Leaf,
  MapPin,
  Plane,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
} from 'lucide-react';

const steps = [
  ['01', 'Organization', 'Add your nonprofit details and mission.'],
  ['02', 'Auction details', 'Set the name, dates, and shareable page link.'],
  ['03', 'Add items', 'List donated items or add Give Holidays experiences.'],
  ['04', 'Payment & fees', 'Connect Stripe and choose how the capped 5% fee is allocated.'],
  ['05', 'Review & launch', 'Preview the bidder experience, then publish.'],
];

const destinations = ['Cabo San Lucas', 'Costa Rica', 'Tuscany', 'Paris', 'Maui', 'New York City'];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f8faf8] text-[#203b31]">
      <header className="sticky top-0 z-50 border-b border-[#dfe7e1]/90 bg-[#f8faf8]/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#175b47]" aria-label="Gather home">
            <span className="grid size-9 place-items-center rounded-full bg-[#dfece4]"><Leaf size={18} /></span>
            gather<span className="-ml-2 text-[#78a68b]">.</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#536b60] md:flex" aria-label="Main navigation">
            <a className="hover:text-[#175b47]" href="#how-it-works">How it works</a>
            <a className="hover:text-[#175b47]" href="#built-for-auctions">Features</a>
            <a className="hover:text-[#175b47]" href="/about/give-holidays">Travel experiences</a>
            <a className="hover:text-[#175b47]" href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/auth?return_to=%2F" className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-[#175b47] hover:bg-[#eaf1ed] sm:px-5">
              Log in
            </a>
            <a href="/onboarding" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#175b47] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#104735] sm:px-5">
              Start an auction <ArrowRight size={16} className="hidden sm:block" />
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#dfe7e1]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#e0ede5_0,transparent_28%),radial-gradient(circle_at_88%_15%,#f5e9d7_0,transparent_24%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#cdded3] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#175b47]">
              <Sparkles size={14} /> Online silent auctions for nonprofits
            </p>
            <h1 className="mt-7 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#18392d] sm:text-6xl lg:text-7xl">
              Raise more with an auction that’s easier to run.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#5d7067] sm:text-xl">
              Gather brings your branded auction page, mobile bidding, winner checkout, and risk-free Give Holidays travel experiences together in one focused platform.
            </p>
            <p className="mt-5 max-w-xl font-semibold text-[#244c3e]">
              5% platform fee, capped at $100 per item. Your nonprofit keeps the rest.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="/onboarding" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[#175b47] px-6 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#104735]">
                Build your auction <ArrowRight size={18} />
              </a>
              <a href="/demo" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-[#cbd9d0] bg-white px-6 font-semibold text-[#254b3d] hover:bg-[#f1f6f3]">
                See a sample auction
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#52695e]">
              <span className="flex items-center gap-2"><Check className="text-[#2f765b]" size={16} /> Guided setup with autosaved drafts</span>
              <span className="flex items-center gap-2"><Check className="text-[#2f765b]" size={16} /> One shareable auction page</span>
              <span className="flex items-center gap-2"><Check className="text-[#2f765b]" size={16} /> No upfront travel package cost</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
            <div className="absolute -left-8 -top-8 size-40 rounded-full bg-[#d8e8de] blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-3 shadow-[0_32px_80px_rgba(23,76,59,0.16)] sm:p-5">
              <div className="overflow-hidden rounded-[1.45rem] bg-[#174c3b] text-white">
                <div className="grid min-h-[410px] sm:grid-cols-[1.12fr_0.88fr]">
                  <div className="flex flex-col justify-between p-7 sm:p-9">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bdd5c7]">Sample auction preview</p>
                      <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">An evening for the arts</h2>
                      <p className="mt-4 max-w-sm leading-7 text-[#dce9e1]">Cabin stays, local dining, and special experiences—all together in one inviting catalog.</p>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <PreviewStat label="Auction items" value="24" />
                      <PreviewStat label="Closes in" value="2 days" />
                    </div>
                  </div>
                  <div className="grid grid-rows-2 gap-2 p-2 sm:pl-0">
                    <div className="relative overflow-hidden rounded-2xl">
                      <img src="/auction-0.jpg" alt="Mountain cabin auction item" className="h-full min-h-48 w-full object-cover" />
                      <div className="absolute inset-x-3 bottom-3 rounded-xl bg-white/95 p-3 text-[#203b31] shadow-sm">
                        <p className="text-xs text-[#687b72]">Featured getaway</p><p className="mt-1 font-semibold">Mountain cabin escape</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <img src="/auction-1.jpg" alt="Chef preparing a dining experience" className="h-full min-h-36 w-full rounded-2xl object-cover" />
                      <img src="/auction-2.jpg" alt="Handmade ceramic bowls" className="h-full min-h-36 w-full rounded-2xl object-cover" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-2xl border border-[#d8e2db] bg-white px-4 py-3 shadow-xl sm:-left-8">
              <span className="grid size-10 place-items-center rounded-full bg-[#e7f1eb] text-[#175b47]"><Gavel size={19} /></span>
              <div><p className="text-xs text-[#6c7c74]">Built for action</p><p className="text-sm font-semibold">Browse. Register. Bid.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]">From idea to live auction</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18392d] sm:text-5xl">Launch in five focused steps.</h2>
            <p className="mt-5 text-lg leading-8 text-[#617269]">Gather guides your team through the essentials one decision at a time. Every draft saves automatically, so you can stop and return without losing your work.</p>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {steps.map(([number, title, copy]) => (
              <article key={number} className="group rounded-2xl border border-[#dfe7e1] bg-[#f8faf8] p-5 transition hover:-translate-y-1 hover:border-[#b9cfc1] hover:bg-white hover:shadow-lg">
                <p className="text-xs font-semibold tracking-[0.15em] text-[#789086]">{number}</p>
                <h3 className="mt-8 font-semibold text-[#1d4234]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#65776e]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="built-for-auctions" className="scroll-mt-24 bg-[#f8faf8] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]">Built around the work that matters</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18392d] sm:text-5xl">A calm workspace for organizers. A clear experience for bidders.</h2></div>
            <p className="max-w-2xl text-lg leading-8 text-[#617269] lg:justify-self-end">Gather is purpose-built for online and mobile silent auctions—without ticketing, seating charts, check-in tools, or other event-night complexity getting in the way.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeaturePoint icon={<LayoutTemplate/>} title="Your nonprofit, front and center" copy="Create one branded home for your mission, auction details, featured items, sponsors, and every auction you run." />
            <FeaturePoint icon={<Smartphone/>} title="Bidding built for any screen" copy="Supporters can browse before registering, place bids from their phones, set a maximum bid, and save items to a watchlist." />
            <FeaturePoint icon={<WalletCards/>} title="A cleaner path from win to paid" copy="Combine a winner’s items into one invoice and show the capped platform fee and payment-processing fees separately." />
            <FeaturePoint icon={<ShieldCheck/>} title="Travel without upfront inventory" copy="Give Holidays packages create a fulfillment obligation only after the auction closes and the winning bidder pays." />
          </div>
        </div>
      </section>

      <section id="travel" className="scroll-mt-24 border-y border-[#dfe7e1] bg-[#edf4ef] py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-10">
          <div className="relative min-h-[470px]">
            <div className="absolute left-0 top-0 h-[82%] w-[78%] overflow-hidden rounded-[2rem] shadow-xl">
              <img src="/auction-3.jpg" alt="Wood-paneled spa getaway" className="h-full w-full object-cover" />
            </div>
            <div className="absolute bottom-0 right-0 w-[64%] rounded-[1.7rem] border border-[#d8e2db] bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-full bg-[#e7f1eb] text-[#175b47]"><Plane size={20} /></span><span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7b8c84]">Give Holidays</span></div>
              <p className="mt-5 text-xl font-semibold tracking-tight">Curated experiences. No upfront package purchase.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {destinations.slice(0, 4).map(destination => <span key={destination} className="rounded-full bg-[#f0f5f2] px-3 py-1.5 text-xs text-[#476157]">{destination}</span>)}
              </div>
            </div>
          </div>
          <div className="lg:pl-8">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]"><Compass size={16} /> The Give Holidays difference</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18392d] sm:text-5xl">Turn dream trips into auction items—without buying them first.</h2>
            <p className="mt-6 text-lg leading-8 text-[#5e7167]">Add curated Give Holidays experiences beside donated items. Bidders see the value, inclusions, restrictions, expiration, and redemption terms before they bid. If a package does not sell—or the winner does not pay—the nonprofit does not owe the travel cost.</p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {destinations.map(destination => (
                <div key={destination} className="flex items-center gap-2 rounded-xl border border-[#d6e2da] bg-white/70 px-3 py-3 text-sm font-medium"><MapPin size={15} className="text-[#397a60]" />{destination}</div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#6d7f76]">Representative destinations shown. Package availability, pricing, and travel terms vary by experience.</p>
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid overflow-hidden rounded-[2rem] border border-[#dce5df] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-[#174c3b] p-8 text-white sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bdd5c7]">Simple, predictable pricing</p>
              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">One fee. Capped at $100.</h2>
              <p className="mt-5 text-lg leading-8 text-[#d8e7de]">5% of what you raise — and never more than $100 on any single item.</p>
            </div>
            <div className="grid gap-7 bg-[#fbfcfb] p-8 sm:grid-cols-3 sm:p-12">
              <div className="sm:col-span-3">
                <p className="leading-7 text-[#4f665c]">Gather charges a 5% platform fee on winning bids, capped at $100 per item. A $200 gift basket costs $10. A $5,000 trip to Venice costs $100. No setup fee, no monthly charge, and no surprise line items. Payment processing (2.9% + $0.30) is separate. Split the platform fee with winning bidders, pass it to them, or cover it yourself.</p>
                <p className="mt-4 rounded-xl bg-[#eaf2ed] px-4 py-3 text-sm font-semibold leading-6 text-[#244c3e]">Other platforms take 5% with no cap — that’s $250 on a $5,000 item. We stop at $100.</p>
              </div>
              <FeePoint icon={<BadgeDollarSign />} title="You choose who covers it" copy="The nonprofit can cover the 5%, pass it to winning bidders, or split it by a percentage you set." />
              <FeePoint icon={<CreditCard />} title="Processing fees stay separate" copy="Payment processing (2.9% + $0.30) is disclosed separately instead of being hidden inside Gather’s fee." />
              <FeePoint icon={<Plane />} title="Travel pricing stays clear" copy="Any Give Holidays markup is included in the package price and identified separately from the capped platform fee." />
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] bg-[#e5efe9] p-8 sm:p-12 lg:flex-row lg:items-center">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]">Ready when you are</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Your next auction can be simpler.</h2><p className="mt-3 max-w-2xl leading-7 text-[#5f7168]">Create the draft, add your first items, and share it only when everything feels ready.</p></div>
          <a href="/onboarding" className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-[#175b47] px-6 font-semibold text-white hover:bg-[#104735]">Build your auction <ArrowRight size={18} /></a>
        </div>
      </section>

      <footer className="border-t border-[#dfe7e1] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#687a71] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-2 font-semibold text-[#175b47]"><Leaf size={17} />gather.</a>
          <p>Simple online auctions and risk-free travel experiences for nonprofits.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><a href="/about/give-holidays" className="hover:text-[#175b47]">About Give Holidays</a><a href="/help" className="hover:text-[#175b47]">Help</a><a href="/legal/privacy" className="hover:text-[#175b47]">Privacy</a><a href="/legal/terms" className="hover:text-[#175b47]">Terms</a><a href="/support" className="hover:text-[#175b47]">Support</a><a href="/auth?return_to=%2F" className="hover:text-[#175b47]">Log in</a><a href="/onboarding" className="hover:text-[#175b47]">Start an auction</a></div>
        </div>
      </footer>
    </main>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/15 bg-white/5 p-3"><p className="text-xs text-[#bcd1c5]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function FeePoint({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <article><span className="grid size-11 place-items-center rounded-full bg-[#e5efe9] text-[#175b47]">{icon}</span><h3 className="mt-5 font-semibold text-[#1d4234]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#617269]">{copy}</p></article>;
}

function FeaturePoint({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <article className="rounded-2xl border border-[#dce5df] bg-white p-6"><span className="grid size-11 place-items-center rounded-full bg-[#e5efe9] text-[#175b47]">{icon}</span><h3 className="mt-6 text-lg font-semibold text-[#1d4234]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#617269]">{copy}</p></article>;
}
