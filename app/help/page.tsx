import { ArrowRight, CheckCircle2, CircleHelp, Heart, Leaf, ShieldCheck } from 'lucide-react';

export const metadata = { title: 'Gather Help Center' };

const sections = [
  ['getting-started', 'Getting started'],
  ['setup', 'Set up an auction'],
  ['items', 'Add items'],
  ['bidding', 'Bidding and bidders'],
  ['fees', 'Fees and payments'],
  ['wins', 'Winners and My Wins'],
  ['holidays', 'Give Holidays'],
  ['organizers', 'Organizer tools'],
  ['questions', 'Common questions'],
] as const;

export default function HelpPage() {
  return <main className="min-h-screen bg-[#f8faf9] text-foreground">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><a href="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#175b47]"><span className="grid size-9 place-items-center rounded-full bg-[#175b47] text-white"><Leaf size={21}/></span>gather<span className="text-[#78a68b]">.</span></a><a href="/onboarding" className="text-sm font-medium text-[#175b47] hover:underline">Create an auction <ArrowRight className="ml-1 inline" size={15}/></a></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="rounded-3xl bg-[#175b47] px-6 py-10 text-white sm:px-10 sm:py-14"><p className="eyebrow text-[#cce8b7]">GATHER HELP CENTER</p><h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Everything you need to run a thoughtful online auction.</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#d4e2da]">Gather keeps the work simple: set up your auction, invite supporters, collect bids, and guide winners through payment and fulfillment.</p></section>
      <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_1fr]">
        <aside className="lg:sticky lg:top-8 lg:h-fit"><p className="eyebrow mb-3 text-[#648371]">IN THIS GUIDE</p><nav className="grid gap-1 rounded-xl border bg-white p-3">{sections.map(([id, label], index) => <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-[#eaf1ed] hover:text-[#175b47]"><span className="mr-2 text-[#78a68b]">{String(index + 1).padStart(2, '0')}</span>{label}</a>)}</nav></aside>
        <article className="min-w-0 space-y-12">
          <GuideSection id="getting-started" eyebrow="01 · GETTING STARTED" title="What Gather is for">
            <p>Gather is for nonprofits running online and mobile silent auctions. Supporters browse a single auction link, place secure maximum bids from any device, and return to one place to see what they are winning.</p>
            <p>Gather is intentionally focused. It is not a full donor CRM, ticketing system, seating-chart tool, or live-event production system. The goal is to make an auction easy to launch and easy for bidders to use.</p>
            <Info title="Before you begin">Have your organization name, auction name, a few item details, and an approximate closing date ready. You can add the rest later.</Info>
          </GuideSection>
          <GuideSection id="setup" eyebrow="02 · SET UP AN AUCTION" title="Use the five-step setup">
            <p>Gather walks organizers through one decision at a time. Your draft saves as you move through the setup flow, so you can stop and return without losing your place.</p>
            <Number title="Organization">Add the nonprofit name, your name, and an email address for the person managing the auction.</Number>
            <Number title="Auction Details">Name the auction and add opening and closing dates when known. Keep the title simple and recognizable to your supporters.</Number>
            <Number title="Add Items">Add the item titles and estimated values you have today. You can return later to add photography, donor credits, descriptions, terms, and bidding settings.</Number>
            <Number title="Payment & Fees">Choose how Gather’s 5% platform commission is allocated: the organization can cover it, winning bidders can cover it, or the organization can choose a split. Payment processing is separate and is always disclosed clearly.</Number>
            <Number title="Review & Launch">Review the essentials, create the auction workspace, then refine the auction before sharing it publicly.</Number>
          </GuideSection>
          <GuideSection id="items" eyebrow="03 · ADD ITEMS" title="Create an auction catalog bidders can understand">
            <p>Each item should answer three questions quickly: What is it? What is included? Why is it valuable?</p>
            <Checklist items={['Use a specific title: “Two-night mountain cabin escape” is clearer than “Cabin stay.”','Add a clean photo that represents the item accurately.','State the fair market value separately from the starting bid.','Name the donor when the donor has approved recognition.','List restrictions, expiration dates, blackout periods, redemption instructions, and any exclusions.','Use categories so bidders can browse travel, dining, art, experiences, wellness, and other groups easily.']}/>
            <Info title="Starting bids">Set a starting bid that encourages activity without undervaluing the item. Gather’s maximum-bid system increases the visible price only as competing bids require it.</Info>
          </GuideSection>
          <GuideSection id="bidding" eyebrow="04 · BIDDING AND BIDDERS" title="How mobile bidding works">
            <p>Bidders open the auction link in their browser—no app download is required. They can browse, search, watch items, and place a maximum bid.</p>
            <p>A maximum bid is the most a bidder is willing to pay. Gather automatically bids only as much as needed to keep that person in the lead, up to their maximum. If two bidders enter the same maximum amount, the earlier bid keeps priority.</p>
            <Checklist items={['The first bid starts at the item’s opening bid, not the bidder’s full maximum.','The current price moves by the configured bid increment when competing bids require it.','Bidders can raise their own maximum without increasing the visible price when no competing bid exists.','A bid placed in the final two minutes extends that item by two minutes, helping prevent last-second sniping.','Bidders can use Watchlist and My Bids to return quickly to items they care about.']}/>
            <Info title="Outbid alerts">Gather can notify bidders when another maximum bid moves ahead of theirs. Alerts should always bring the bidder directly back to the relevant item.</Info>
          </GuideSection>
          <GuideSection id="fees" eyebrow="05 · FEES AND PAYMENTS" title="Keep fees transparent">
            <p>Gather charges a 5% platform commission on eligible auction transactions. There is no upfront platform charge to create an auction.</p>
            <div className="grid gap-3 sm:grid-cols-3"><Card title="Organization pays" copy="The nonprofit absorbs the full 5% platform commission."/><Card title="Winner pays" copy="The 5% platform commission is added to eligible winning invoices."/><Card title="Split fees" copy="The nonprofit chooses the percentage each side covers."/></div>
            <p>Credit-card processing is not part of Gather’s 5% platform commission. Processing costs are shown separately during checkout, with the responsible payer clearly identified before payment.</p>
            <Info title="No surprise charges">A bidder should always see the winning item amount, Gather platform commission when passed through, applicable processing cost, and final total before submitting payment.</Info>
          </GuideSection>
          <GuideSection id="wins" eyebrow="06 · WINNERS AND MY WINS" title="What happens after bidding closes">
            <p>When an item closes, Gather identifies the winner using the same maximum-bid and tie-breaking rules used throughout the auction. Every winning item is grouped into the bidder’s My Wins area and combined into one invoice whenever possible.</p>
            <Checklist items={['Winners see each item they won, the winning amount, applicable fees, and the total due.','One checkout lets a winner pay for all eligible items together.','A successful payment creates a receipt and updates the organizer’s payment status.','Organizers can see unpaid, paid, refunded, and fulfillment statuses without maintaining a separate spreadsheet.','Refunds must be recorded against the original payment and reflected in the winner’s receipt history.']}/>
          </GuideSection>
          <GuideSection id="holidays" eyebrow="07 · GIVE HOLIDAYS" title="Add risk-free travel experiences">
            <p>Give Holidays Experiences are curated travel packages that a nonprofit can add to its auction without purchasing inventory upfront. The nonprofit pays nothing for an unsold package.</p>
            <p>Organizers browse available packages, review the bidder-facing description and terms, then add the selected experience to an auction like any other item. Core package terms, availability rules, and internal travel costs remain controlled by Give Holidays.</p>
            <Checklist items={['Bidders see the package description, imagery, what is included, fair market value, restrictions, and expiration before bidding.','Winning a package adds it to My Wins and the winner’s combined invoice.','A package becomes a fulfillment obligation only after the winner’s payment succeeds.','After payment, the winner submits traveler details and preferred dates through a claim workflow.','Give Holidays tracks the package from paid to traveler details submitted, dates requested, booking in progress, confirmed, fulfilled, cancelled, or refunded.']}/>
            <Info title="Important travel terms">Travel packages are subject to their published availability, blackout dates, booking deadlines, cancellation terms, and redemption instructions. Never promise a date before Give Holidays confirms it.</Info>
          </GuideSection>
          <GuideSection id="organizers" eyebrow="08 · ORGANIZER TOOLS" title="Manage the auction without clutter">
            <p>Your organizer workspace is where you prepare the catalog, pause or resume bidding when necessary, review activity, see winner payment status, and export your auction records.</p>
            <Checklist items={['Keep unfinished items in draft until they are ready for bidders.','Preview the auction before sharing its public link.','Use one clear auction link in email, social posts, and QR codes.','Review payment and fulfillment status after the auction closes.','Export auction records for thank-you notes, reconciliation, and internal reporting.']}/>
          </GuideSection>
          <GuideSection id="questions" eyebrow="09 · COMMON QUESTIONS" title="Questions organizers and bidders ask">
            <Faq question="Does Gather charge anything before an auction raises money?" answer="No. Gather’s platform commission applies only to eligible completed auction transactions."/>
            <Faq question="Can a nonprofit choose who pays the 5% platform commission?" answer="Yes. The organization can cover all of it, pass all of it to winning bidders, or choose a configurable split."/>
            <Faq question="Are payment-processing fees included in the 5%?" answer="No. Payment-processing costs are separate and shown clearly at checkout."/>
            <Faq question="What if a winner does not pay?" answer="The organizer sees the invoice as unpaid and can follow up. An unsold Give Holidays package does not create a travel-payment obligation for the nonprofit."/>
            <Faq question="Can a bidder use more than one device?" answer="Yes. A bidder can return to the same auction link from another device after signing into the same account."/>
            <Faq question="What if an item closes while I am bidding?" answer="Bids placed in the final two minutes extend that item by two minutes. Once an item is closed, no additional bids are accepted."/>
            <Faq question="Can I run a full gala night with tickets, seating, raffles, and a live screen?" answer="Gather is focused first on online and mobile silent auctions. Those broader event-management tools are not part of the initial auction workflow."/>
          </GuideSection>
          <section className="rounded-2xl bg-[#eaf1ed] p-6 sm:p-8"><div className="flex gap-4"><Heart className="mt-1 shrink-0 text-[#175b47]" size={25}/><div><h2 className="text-xl font-semibold">Still need a hand?</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Start with the five-step setup and keep the first auction simple. A clear catalog, a visible closing date, and a direct link for bidders matter more than adding every possible feature.</p><a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#175b47] hover:underline" href="/onboarding">Start your auction <ArrowRight size={15}/></a></div></div></section>
        </article>
      </div>
    </div>
  </main>;
}

function GuideSection({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-8"><p className="eyebrow text-[#648371]">{eyebrow}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2><div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">{children}</div></section>; }
function Number({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border-l-2 border-[#b4d5bd] pl-4"><h3 className="font-semibold text-foreground">{title}</h3><p className="mt-1 text-sm">{children}</p></div>; }
function Info({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border border-[#dce9df] bg-[#fafcfb] p-4 text-sm"><p className="font-semibold text-[#175b47]">{title}</p><p className="mt-1">{children}</p></div>; }
function Checklist({ items }: { items: string[] }) { return <ul className="space-y-3">{items.map(item => <li key={item} className="flex gap-3 text-sm"><CheckCircle2 className="mt-0.5 shrink-0 text-[#2f7d5b]" size={17}/><span>{item}</span></li>)}</ul>; }
function Card({ title, copy }: { title: string; copy: string }) { return <div className="rounded-xl border bg-white p-4"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{copy}</p></div>; }
function Faq({ question, answer }: { question: string; answer: string }) { return <div className="border-b pb-5"><h3 className="font-semibold text-foreground">{question}</h3><p className="mt-2 text-sm">{answer}</p></div>; }
