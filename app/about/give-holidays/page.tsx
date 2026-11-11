/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- The supplied transparent logo needs exact clipping, and full-page links remain reliable in the hosted Vinext build. */
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BarChart3,
  BedDouble,
  CalendarDays,
  Heart,
  Leaf,
  MousePointer2,
  Plane,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Give Holidays | Travel That Gives Back',
  description: 'Exceptional travel packages for charity auctions, curated by Give Holidays and offered through Gather.',
};

const benefits = [
  { icon: Star, title: 'Auction-Ready Packages', copy: 'Turnkey travel experiences designed to attract attention and drive higher bids.' },
  { icon: ShieldCheck, title: 'Trusted & Reliable', copy: 'Work with a dedicated travel team that handles the details from start to finish.' },
  { icon: BarChart3, title: 'Greater Fundraising Results', copy: 'High-perceived-value packages that consistently raise more for your cause.' },
  { icon: Leaf, title: 'Built for Nonprofits', copy: 'Flexible options, expert guidance, and support tailored to charity events of any size.' },
];

const steps = [
  { icon: Search, title: '1. Browse Packages', copy: 'Explore a curated collection of high-demand travel experiences.' },
  { icon: MousePointer2, title: '2. Choose & Customize', copy: 'Select the right packages for your event and audience.' },
  { icon: CalendarDays, title: '3. Add to Your Auction', copy: 'We provide everything you need — descriptions, images, and terms.' },
  { icon: Heart, title: '4. Drive More for Your Cause', copy: 'Excite your bidders, raise more funds, and create unforgettable experiences.' },
];

const referenceCrop = (x: number, y: number): CSSProperties => ({
  backgroundImage: "url('/give-holidays-reference.png')",
  backgroundPosition: `${-x}px ${-y}px`,
  backgroundRepeat: 'no-repeat',
  backgroundSize: '1024px 1536px',
});

function GiveHolidaysLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${compact ? 'h-[66px] w-[250px]' : 'h-[94px] w-full max-w-[430px]'}`} aria-label="Give Holidays">
      <img
        src="/give-holidays-logo.png"
        alt="Give Holidays"
        className={`absolute max-w-none ${compact ? '-left-[24px] -top-[17px] w-[286px]' : '-left-[36px] -top-[23px] w-[450px]'}`}
      />
    </div>
  );
}

export default function GiveHolidaysPage() {
  return (
    <main className="min-h-screen bg-white text-[#092f29]">
      <header className="border-b border-[#e4ece8] bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <a href="/" className="flex items-center gap-2 text-[24px] font-bold tracking-[-0.04em] text-[#0c392f]" aria-label="Gather home">
            <span className="grid size-9 place-items-center rounded-full bg-[#e3f2e9] text-[#12664f]"><Leaf size={20}/></span>
            gather<span className="-ml-2 text-[#66b88d]">.</span>
          </a>
          <nav className="hidden items-center gap-10 text-[14px] font-medium text-[#142f2b] md:flex" aria-label="Primary navigation">
            <a href="/demo" className="transition hover:text-[#087058]">Auctions</a>
            <a href="#packages" className="transition hover:text-[#087058]">Travel Packages</a>
            <a href="#nonprofits" className="transition hover:text-[#087058]">For Nonprofits</a>
            <a href="#how-it-works" className="transition hover:text-[#087058]">About</a>
          </nav>
          <a href="/onboarding" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0c684f] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#07513f]">
            Start an Auction <ArrowRight size={16}/>
          </a>
        </div>
      </header>

      <section className="bg-[radial-gradient(circle_at_57%_3%,#edf6f2_0,transparent_34%),linear-gradient(180deg,#fff_0%,#fff_100%)]">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[0.86fr_1.14fr] md:items-center md:py-8 lg:gap-10 lg:py-10">
          <div>
            <p className="inline-flex rounded-full bg-[#eaf4ef] px-6 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#164c3d]">A Gather Travel Partner</p>
            <GiveHolidaysLogo/>
            <h1 className="mt-2 max-w-[510px] text-[43px] font-bold leading-[1.03] tracking-[-0.045em] text-[#073a31] md:text-[46px] xl:text-[54px]">
              Exceptional Travel Packages for Charity Auctions
            </h1>
            <p className="mt-5 max-w-[520px] text-[14px] leading-6 text-[#243b37]">
              Turn travel into greater impact. Give Holidays provides curated, high-value travel experiences that excite bidders, drive higher bids, and raise more for your cause.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#packages" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#087058] px-5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(7,92,73,.15)] transition hover:bg-[#075440]">Explore Travel Packages <ArrowRight size={15}/></a>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center rounded-full border border-[#0c5948] px-5 text-[13px] font-bold text-[#0a4538] transition hover:bg-[#edf6f2]">How It Works</a>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-[38px_38px_38px_76px] bg-[#d5ebe2] shadow-[0_20px_50px_rgba(12,70,54,.08)]" style={referenceCrop(470, 106)} role="img" aria-label="Luxury tropical resort overlooking the ocean">
            <div className="absolute inset-x-0 bottom-0 h-28 bg-[#d8ebe3]/95"/>
            <div className="absolute inset-x-5 bottom-5 z-10 grid grid-cols-3 gap-2 rounded-[24px] bg-white/95 px-5 py-4 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-center gap-3 border-r border-[#dce8e2]"><Plane className="shrink-0 text-[#0c624e]" size={25}/><span className="text-[12px] font-bold leading-tight text-[#153d33]">Premium<br/>Destinations</span></div>
              <div className="flex items-center justify-center gap-3 border-r border-[#dce8e2]"><BedDouble className="shrink-0 text-[#0c624e]" size={25}/><span className="text-[12px] font-bold leading-tight text-[#153d33]">Curated<br/>Packages</span></div>
              <div className="flex items-center justify-center gap-3"><Heart className="shrink-0 text-[#0c624e]" size={25}/><span className="text-[12px] font-bold leading-tight text-[#153d33]">Higher<br/>Auction Results</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="nonprofits" className="border-y border-[#eef4f1] bg-[radial-gradient(circle_at_50%_35%,#e5f2ec_0,transparent_67%),#f7fbf9] py-8">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="text-center">
            <h2 className="text-[34px] font-bold tracking-[-0.035em] text-[#073a31] sm:text-[40px]">Why Nonprofits Choose Give Holidays</h2>
            <p className="mt-2 text-[15px] text-[#263d38]">A trusted travel partner that makes fundraising travel simple, profitable, and worry-free.</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {benefits.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-[18px] border border-white/80 bg-white/90 p-6 shadow-[0_7px_30px_rgba(7,58,49,.04)]">
                <span className="grid size-12 place-items-center rounded-full bg-[#e8f5ef] text-[#0b6c54]"><Icon size={25}/></span>
                <h3 className="mt-4 text-[18px] font-bold leading-[1.08] tracking-[-0.03em] text-[#092f29]">{title}</h3>
                <p className="mt-3 text-[13px] leading-5 text-[#263b37]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="packages" className="px-0 py-4 sm:px-5">
        <div className="mx-auto grid max-w-[1180px] gap-8 overflow-hidden bg-[radial-gradient(circle_at_78%_30%,#a5c8b8_0,transparent_34%),linear-gradient(110deg,#08644e_0%,#075340_58%,#dcebe4_100%)] px-6 py-5 text-white sm:rounded-[28px] sm:px-10 md:grid-cols-[1.05fr_1.95fr] md:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#d6ece2]">Featured Experiences</p>
            <h2 className="mt-3 text-[34px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[42px]">Incredible Getaways That Give Back</h2>
            <p className="mt-4 max-w-[390px] text-[14px] leading-5 text-[#eef8f4]">From luxury escapes to bucket-list adventures, our travel packages inspire bidding and create lasting memories — all while supporting your mission.</p>
            <a href="/onboarding" className="mt-5 inline-flex min-h-11 items-center gap-3 rounded-full bg-white px-6 text-[14px] font-bold text-[#153c33] transition hover:bg-[#eff7f3]">View Example Packages <ArrowRight size={17}/></a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: 'Italy Getaway', detail: '7 Nights for Two', crop: [377, 922] },
              { title: 'Caribbean Escape', detail: '5 Nights for Two', crop: [592, 922] },
              { title: 'New York Experience', detail: '3 Nights for Two', crop: [805, 922] },
            ].map((trip) => (
              <article key={trip.title} aria-label={`${trip.title}, ${trip.detail}`} className="relative min-h-[218px] overflow-hidden rounded-[22px] border-2 border-white shadow-[0_12px_30px_rgba(0,0,0,.16)]" style={referenceCrop(trip.crop[0], trip.crop[1])}>
                <span className="sr-only">{trip.title}, {trip.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-8">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="text-center">
            <h2 className="text-[34px] font-bold tracking-[-0.04em] text-[#073a31] sm:text-[40px]">How It Works</h2>
            <p className="mt-2 text-[15px] text-[#263d38]">A simple, seamless process from package selection to a successful auction.</p>
          </div>
          <div className="relative mt-8 grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-5">
            <div className="absolute left-[10%] right-[10%] top-[30px] hidden border-t-2 border-dashed border-[#9dceb9] md:block"/>
            {steps.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="relative z-10 text-center">
                <span className="mx-auto grid size-[62px] place-items-center rounded-full bg-[#e5f3ec] text-[#087058]"><Icon size={29}/></span>
                <h3 className="mt-4 text-[16px] font-bold tracking-[-0.02em] text-[#102f29]">{title}</h3>
                <p className="mx-auto mt-2 max-w-[230px] text-[13px] leading-[1.35] text-[#263b37]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-5 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 rounded-[18px] bg-[linear-gradient(100deg,#08634d_0%,#075440_65%,#0e6b53_100%)] px-7 py-5 text-white md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center gap-7">
            <div className="hidden shrink-0 border-r border-white/45 pr-7 sm:block [&_img]:brightness-0 [&_img]:invert"><GiveHolidaysLogo compact/></div>
            <div><h2 className="text-[23px] font-bold tracking-[-0.025em]">Let&apos;s Turn Travel into Greater Impact</h2><p className="mt-1 text-[14px] leading-5 text-white/90">Add unforgettable travel experiences to your next auction<br className="hidden sm:block"/> and give your supporters a reason to bid higher.</p></div>
          </div>
          <a href="/onboarding" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-white px-7 text-[14px] font-bold text-[#123c32] transition hover:bg-[#edf6f2]">Get Started Today <ArrowRight size={17}/></a>
        </div>
      </section>
    </main>
  );
}
