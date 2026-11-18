"use client";

import type { ReactNode } from "react";
import { BadgeDollarSign, Bot, ChevronDown, Contact, FileBarChart, Gavel, HandCoins, Handshake, History, LayoutDashboard, LayoutTemplate, LogOut, Mail, Menu, MessageSquare, PackageSearch, Plane, Plus, Settings, ShieldCheck, Target, Ticket, Users, WandSparkles, X } from "lucide-react";

export function OrganizerShell({ children, auctionId, auctionName, organizationId, organizationName, nonprofitSlug, activeItem = "Overview", workspace = "organizer" }: { children: ReactNode; auctionId: string; auctionName: string; organizationId: string; organizationName: string; nonprofitSlug?: string; activeItem?: string; workspace?: "organizer" | "emailMarketing" }) {
  const query = `organization=${encodeURIComponent(organizationId)}&auction=${encodeURIComponent(auctionId)}`;
  const items = [
    ["Overview", `/admin?auction=${encodeURIComponent(auctionId)}`, LayoutDashboard],
    ["Auction page", `/homepage?nonprofit=${encodeURIComponent(organizationId)}`, LayoutTemplate],
    ["Items", `/?view=Manage%20items&auction=${encodeURIComponent(auctionId)}`, PackageSearch],
    ["Supporters", `/admin/supporters?organization=${encodeURIComponent(organizationId)}`, Users],
    ["Messages", `/messages?${query}`, MessageSquare],
    ["Email Marketing", `/admin/email-marketing?${query}`, Mail],
    ["Email & receipts", `/admin/settings/email-receipts?organization=${encodeURIComponent(organizationId)}`, Mail],
    ["Payments", `/admin/settlement?auction=${encodeURIComponent(auctionId)}`, BadgeDollarSign],
    ["Tickets", `/admin/tickets?${query}`, Ticket],
    ["Sponsors", `/admin/sponsors?${query}`, Handshake],
    ["Direct offers", `/admin/direct-offers?organization=${encodeURIComponent(organizationId)}`, Plane],
    ["Gather Live", `/admin/live?auction=${encodeURIComponent(auctionId)}`, Gavel],
    ["Reports", `/admin/settlement?auction=${encodeURIComponent(auctionId)}#reports`, FileBarChart],
    ["Close out event", `/admin/settlement?auction=${encodeURIComponent(auctionId)}`, HandCoins],
    ["Past auctions", `/admin/auctions?auction=${encodeURIComponent(auctionId)}`, History],
  ] as const;
  const marketingItems = [
    ["Email Campaigns", `/admin/email-marketing?${query}`, Mail],
    ["Audiences", `/admin/email-marketing?${query}&view=audiences`, Users],
    ["Contacts", `/admin/supporters?organization=${encodeURIComponent(organizationId)}`, Contact],
    ["Opportunities", `/admin/email-marketing?${query}&view=opportunities`, Target],
    ["Automations", `/admin/email-marketing?${query}&view=automations`, Bot],
    ["Templates", `/admin/email-marketing?${query}&view=templates`, WandSparkles],
    ["Email Reports", `/admin/email-marketing?${query}&view=reports`, FileBarChart],
  ] as const;
  const navigationLink = ([label, href, Icon]: (typeof items)[number] | (typeof marketingItems)[number]) => <a key={label} href={href} aria-current={activeItem === label ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${activeItem === label ? "bg-[#dfece5] text-[#0f5a43]" : "text-[#385248] hover:bg-[#edf3ef] hover:text-[#164f3d]"}`}><Icon size={18}/><span>{label}</span></a>;
  const navigation = <>
    <a href="/" className="flex items-center gap-2 px-3 text-2xl font-semibold tracking-tight text-[#175b47]"><span className="grid size-9 place-items-center rounded-full bg-[#175b47] text-sm text-white">G</span>gather<span className="-ml-2 text-[#78a68b]">.</span></a>
    <div className="mt-7 rounded-xl border bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Organization</p><p className="mt-2 truncate text-sm font-semibold text-[#173f34]">{organizationName}</p><div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[#f1f6f3] px-3 py-2 text-sm"><span className="truncate">{auctionName}</span><ChevronDown size={15}/></div></div>
    {workspace === "emailMarketing" && <nav className="mt-6 space-y-1" aria-label="CRM and email marketing"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">CRM &amp; Email Marketing</p>{marketingItems.map(navigationLink)}</nav>}
    <nav className={`${workspace === "emailMarketing" ? "mt-7 border-t pt-5" : "mt-6"} space-y-1`} aria-label="Organizer workspace">{workspace === "emailMarketing" && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Organizer workspace</p>}{items.map(navigationLink)}</nav>
    <div className="mt-6 border-t pt-4"><a href="/onboarding" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#175b47] hover:bg-[#edf3ef]"><Plus size={18}/>New auction</a><a href="/admin/security" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#385248] hover:bg-[#edf3ef]"><ShieldCheck size={18}/>Security</a><a href="/?view=Settings" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#385248] hover:bg-[#edf3ef]"><Settings size={18}/>Settings</a>{nonprofitSlug && <a href={`/n/${nonprofitSlug}`} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg border px-3 py-2 text-center text-sm font-semibold text-[#175b47] hover:bg-white">View auction as bidder</a>}<a href="/auth/signout?return_to=%2F" className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-[#d7e2db] px-3 text-sm font-semibold text-[#7b413c] hover:bg-red-50"><LogOut size={18}/>Sign out</a></div>
  </>;
  return <div className="min-h-screen bg-[#f8faf9] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"><aside className="hidden min-h-screen border-r bg-[#fbfdfc] px-4 py-7 lg:block">{navigation}</aside><div className="min-w-0"><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:hidden"><a href="/" className="text-xl font-semibold tracking-tight text-[#175b47]">gather<span className="text-[#78a68b]">.</span></a><details className="group relative"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border px-3 text-sm font-semibold text-[#175b47]"><Menu size={18}/>Menu</summary><div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbfdfc] px-4 py-5 shadow-xl"><div className="mb-4 flex justify-end"><span className="flex size-11 items-center justify-center rounded-lg border"><X size={19}/></span></div>{navigation}</div></details></header><main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 xl:px-10">{children}</main></div></div>;
}
