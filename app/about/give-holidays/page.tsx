import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  HandHeart,
  HeartHandshake,
  Leaf,
  Plane,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Give Holidays | Gather',
  description: 'Learn how Give Holidays brings expert travel care and concierge-style service to charitable fundraising experiences.',
};

const commitments = [
  {
    icon: <Compass size={20} />,
    title: 'Thoughtfully selected',
    copy: 'Curated travel experiences supported by decades of hospitality and wholesale travel expertise.',
  },
  {
    icon: <HeartHandshake size={20} />,
    title: 'Personally supported',
    copy: 'Knowledgeable help, attentive coordination, and a real travel partner when questions arise.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Handled with care',
    copy: 'Clear expectations, responsible service, and respect for the trust placed in every experience.',
  },
];

export default function AboutGiveHolidaysPage() {
  return (
    <main className="min-h-screen bg-[#f8faf8] text-[#203b31]">
      <header className="border-b border-[#dfe7e1] bg-white/95">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#175b47]" aria-label="Gather home">
            <span className="grid size-9 place-items-center rounded-full bg-[#dfece4]"><Leaf size={18} /></span>
            gather<span className="-ml-2 text-[#78a68b]">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/help/travel" className="hidden min-h-11 items-center px-4 text-sm font-semibold text-[#175b47] hover:underline sm:inline-flex">Travel experiences</Link>
            <Link href="/onboarding" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#175b47] px-4 text-sm font-semibold text-white transition hover:bg-[#104735] sm:px-5">
              Start an auction <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#dfe7e1] bg-[#edf4ef]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#d6e8dd_0,transparent_32%),radial-gradient(circle_at_88%_12%,#f5e6cf_0,transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-10 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#c9ddd0] bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.17em] text-[#175b47]">
              <Plane size={15} /> About Give Holidays
            </p>
            <h1 className="mt-7 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#18392d] sm:text-6xl lg:text-7xl">
              The people who give deserve our very best.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#586e63] sm:text-xl">
              At Give Holidays, we believe the people who give generously to others represent the very best of us. They show up for their communities, support causes they believe in, and make a meaningful difference in the lives of others.
            </p>
            <p className="mt-5 text-xl font-semibold text-[#1f4c3a]">We believe they deserve something extraordinary in return.</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="overflow-hidden rounded-[2rem] border-[10px] border-white bg-white shadow-[0_30px_80px_rgba(23,76,59,0.18)]">
              <img src="/auction-3.jpg" alt="A peaceful wood-paneled travel retreat" className="h-[470px] w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-2 max-w-xs rounded-2xl border border-[#d5e1d9] bg-white p-5 shadow-xl sm:-left-8">
              <span className="grid size-10 place-items-center rounded-full bg-[#e7f1eb] text-[#175b47]"><HandHeart size={19} /></span>
              <p className="mt-3 font-semibold text-[#1d4234]">That belief is at the heart of everything we do.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]">Our approach</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18392d] sm:text-5xl">A different approach to fundraising travel.</h2>
          </div>
          <div className="max-w-3xl text-lg leading-8 text-[#5d7067]">
            <p className="font-semibold text-[#244c3d]">The generosity behind a winning auction bid deserves to be met with equally exceptional care.</p>
            <p className="mt-6">Backed by more than two decades of experience in hospitality, travel sourcing, and the wholesale travel industry, we bring professional travel expertise and a personal, concierge-style approach to charitable fundraising.</p>
            <p className="mt-6">We work with nonprofit organizations to offer thoughtfully curated travel experiences that help support their fundraising efforts while giving their supporters something wonderful to look forward to.</p>
            <p className="mt-6">But our commitment doesn&apos;t end when the auction closes.</p>
            <p className="mt-2 font-semibold text-[#1d4234]">In many ways, that&apos;s where it begins.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dfe7e1] bg-[#f3f7f4] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]">A personal commitment</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18392d] sm:text-5xl">More than a vacation.</h2>
            <p className="mt-6 text-lg leading-8 text-[#5d7067]">When someone purchases a travel experience at a charity auction, they&apos;ve done something special. They could have booked a vacation anywhere. Instead, they chose to support a school, a community organization, a medical foundation, or another cause close to their heart.</p>
            <p className="mt-4 text-xl font-semibold text-[#1d4234]">We don&apos;t take that decision lightly.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {commitments.map((commitment) => (
              <article key={commitment.title} className="rounded-2xl border border-[#dce5df] bg-white p-6 shadow-sm">
                <span className="grid size-11 place-items-center rounded-full bg-[#e5efe9] text-[#175b47]">{commitment.icon}</span>
                <h3 className="mt-6 text-lg font-semibold text-[#1d4234]">{commitment.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#617269]">{commitment.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 grid gap-6 text-lg leading-8 text-[#5d7067] lg:grid-cols-2">
            <p>From answering questions and coordinating travel arrangements to helping resolve the unexpected, we want every guest to know there is someone looking after their experience.</p>
            <p>Because exceptional hospitality isn&apos;t simply about beautiful destinations or first-class accommodations. <strong className="text-[#1d4234]">It&apos;s about making people feel valued.</strong></p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f765b]">Our gratitude</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#18392d] sm:text-5xl">Your generosity deserves our gratitude.</h2>
          </div>
          <div className="max-w-3xl text-lg leading-8 text-[#5d7067]">
            <p>We believe charitable giving should be recognized with something more meaningful than a transaction confirmation.</p>
            <p className="mt-6">Every Give Holidays guest is someone who made a conscious decision to help others. We want them to feel appreciated, respected, and cared for throughout their journey.</p>
            <p className="mt-6">That means being transparent about their travel experience, taking responsibility for the service we provide, and treating every guest with the attention we would want for the people closest to us.</p>
            <p className="mt-6">We don&apos;t believe a winning bidder should be handed a travel certificate and left to figure everything out.</p>
            <p className="mt-2 font-semibold text-[#1d4234]">We believe they deserve a travel partner who shows up.</p>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#174c3b] px-7 py-12 text-white sm:px-12 sm:py-16 lg:px-16">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bdd5c7]">Our promise</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">We show up.</h2>
            </div>
            <div className="max-w-3xl text-lg leading-8 text-[#dce9e1]">
              <p>To the nonprofit organizations that place their trust in us, we understand that your reputation travels with every guest.</p>
              <p className="mt-6">To the generous individuals who choose a Give Holidays experience, we want you to know something:</p>
              <p className="mt-6 text-2xl font-semibold leading-9 text-white">We see your generosity. We appreciate what you&apos;ve done. And we consider it a privilege to serve you.</p>
              <p className="mt-8">You showed up for someone else.</p>
              <p className="font-semibold text-white">Now it&apos;s our turn to show up for you.</p>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-5 border-t border-white/15 pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-semibold">Give Holidays</p>
              <p className="mt-1 max-w-xl italic text-[#bdd5c7]">The people who show up for others deserve a travel partner who shows up for them.</p>
            </div>
            <Link href="/onboarding" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 font-semibold text-[#175b47] transition hover:bg-[#edf4ef]">Start your auction <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#dfe7e1] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#687a71] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#175b47]"><Leaf size={17} />gather.</Link>
          <p>Simple online auctions and risk-free travel experiences for nonprofits.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/about/give-holidays" aria-current="page" className="font-semibold text-[#175b47]">About Give Holidays</Link>
            <Link href="/help" className="hover:text-[#175b47]">Help</Link>
            <Link href="/legal/privacy" className="hover:text-[#175b47]">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-[#175b47]">Terms</Link>
            <Link href="/support" className="hover:text-[#175b47]">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
