import { ExternalLink, Handshake } from "lucide-react";

export type PublicSponsorData = {
  sponsors: {
    id: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    description: string;
    tierName: string;
    tierRank: number;
    displayStyle: "presenting" | "prominent" | "compact";
    displayOrder: number;
  }[];
  itemSponsors: Record<string, { name: string; logoUrl: string | null }[]>;
  feeSponsor: { name: string; logoUrl: string | null; copy: string } | null;
};

export function SponsorShowcase({ data }: { data: PublicSponsorData | null }) {
  if (!data?.sponsors.length && !data?.feeSponsor) return null;
  const tiers = new Map<string, PublicSponsorData["sponsors"]>();
  for (const sponsor of data.sponsors) tiers.set(sponsor.tierName, [...(tiers.get(sponsor.tierName) || []), sponsor]);
  return (
    <section className="mt-10 rounded-3xl border bg-[#f7faf8] px-5 py-9 sm:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#e7f1eb] text-[#175b47]"><Handshake size={20} /></span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Our Event Sponsors</h2>
        <p className="mt-2 text-sm text-muted-foreground">Supporting our mission and making this event possible.</p>
        <div className="mt-7 space-y-7">
          {[...tiers.entries()].map(([tierName, sponsors]) => (
            <div key={tierName}><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-[#648371]">{tierName}</p><div className={`grid gap-3 ${sponsors[0]?.displayStyle === "presenting" ? "grid-cols-1" : sponsors[0]?.displayStyle === "prominent" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`}>{sponsors.map((sponsor) => {
              const card = <div className={`flex h-full items-center gap-4 rounded-2xl border bg-white ${sponsor.displayStyle === "presenting" ? "justify-center p-7" : "p-4"}`}><span className={`${sponsor.displayStyle === "compact" ? "size-12" : "size-16"} grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[#edf4ef] text-lg font-semibold text-[#175b47]`}>{sponsor.logoUrl ? <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="size-full object-contain p-2" /> : sponsor.name.slice(0, 1)}</span><span className="min-w-0 text-left"><strong className="block truncate">{sponsor.name}</strong>{sponsor.description && sponsor.displayStyle !== "compact" && <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{sponsor.description}</span>}</span>{sponsor.websiteUrl && <ExternalLink className="ml-auto shrink-0 text-muted-foreground" size={14} />}</div>;
              return sponsor.websiteUrl ? <a key={sponsor.id} href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#175b47]">{card}</a> : <div key={sponsor.id}>{card}</div>;
            })}</div></div>
          ))}
        </div>
        {data.feeSponsor && <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[#175b47] p-6 text-white sm:flex-row sm:text-left"><span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 text-lg font-semibold text-[#175b47]">{data.feeSponsor.logoUrl ? <img src={data.feeSponsor.logoUrl} alt={`${data.feeSponsor.name} logo`} className="size-full object-contain p-2" /> : data.feeSponsor.name.slice(0, 1)}</span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-white/70">Official Transaction Fee Sponsor</p><p className="mt-2 text-sm leading-6 text-white/90">{data.feeSponsor.copy}</p></div></div>}
      </div>
    </section>
  );
}
