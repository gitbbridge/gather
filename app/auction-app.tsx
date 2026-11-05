"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Heart,
  Search,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Gift,
  Leaf,
  Bell,
  LayoutGrid,
  Gavel,
  ChartNoAxesCombined,
  Settings,
  Plus,
  Download,
  Check,
  Users,
  Menu,
  ShieldCheck,
  Package,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Toaster, toast } from "sonner";
import { NonprofitSettings } from "@/app/nonprofit-settings";
import { AdminDashboard } from "@/components/tailwind-ui/admin-dashboard";
import {
  SponsorShowcase,
  type PublicSponsorData,
} from "@/components/sponsor-showcase";
import type { NonprofitPublic } from "@/lib/nonprofits";
import { createAuction, publicState, money } from "@/lib/auction";
type State = ReturnType<typeof publicState>;
type Item = State["items"][number];
type Data = {
  nonprofit?: NonprofitPublic | null;
  registered?: boolean;
  state: State;
  user: { name: string } | null;
  owner: boolean;
  demo: boolean;
  id?: string;
  list: { id: string; name: string }[];
};
const categories = [
  "All items",
  "Getaways",
  "Food & drink",
  "Art & home",
  "Wellness",
  "Experiences",
];
const initial: Data = {
  state: publicState(createAuction(), " ", false),
  user: null,
  owner: false,
  demo: true,
  list: [],
};
export default function AuctionApp({
  auctionId = "",
  bidderMode = false,
  initialView = "Explore auction",
}: {
  auctionId?: string;
  bidderMode?: boolean;
  initialView?: string;
}) {
  const [data, setData] = useState<Data>(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState(initialView),
    [category, setCategory] = useState("All items"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("featured"),
    [selected, setSelected] = useState<Item | null>(null),
    [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [amount, setAmount] = useState(""),
    [sponsorData, setSponsorData] = useState<PublicSponsorData | null>(null),
    [now, setNow] = useState(0),
    [id, setId] = useState("");
  const load = useCallback(async (auctionId?: string) => {
    try {
      const r = await fetch(
        "/api/auction" +
          (auctionId ? "?id=" + encodeURIComponent(auctionId) : ""),
      );
      const d = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw Error(d.error);
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const value =
      auctionId ||
      new URLSearchParams(window.location.search).get("auction") ||
      "";
    setId(value);
    load(value);
    if (value)
      fetch(`/api/sponsors/public?auction=${encodeURIComponent(value)}`)
        .then((response) => response.json())
        .then((result) => setSponsorData(result as PublicSponsorData))
        .catch(() => setSponsorData(null));
    setNow(Date.now());
  }, [load, auctionId]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const p = setInterval(() => load(id), 15000);
    return () => {
      clearInterval(t);
      clearInterval(p);
    };
  }, [id, load]);
  const a = data.state;
  useEffect(() => {
    const itemId = new URLSearchParams(window.location.search).get("item");
    if (!loading && itemId) {
      const i = data.state.items.find((i) => i.id === itemId);
      if (i) {
        setSelected(i);
        setAmount(
          String(
            (i.leading
              ? i.myMax + i.increment
              : i.bidCount
                ? i.price + i.increment
                : i.start) / 100,
          ),
        );
      }
      const u = new URL(window.location.href);
      u.searchParams.delete("item");
      window.history.replaceState({}, "", u.pathname + u.search);
    }
  }, [loading, data.state.items]);
  const registerToBid = (itemId: string) => {
    if (data.nonprofit) {
      window.location.assign(
        `/n/${data.nonprofit.slug}/join?auction=${encodeURIComponent(data.id || "")}&item=${encodeURIComponent(itemId)}`,
      );
    } else {
      window.location.assign(
        "/signin-with-chatgpt?return_to=" +
          encodeURIComponent(
            window.location.pathname +
              "?auction=" +
              (data.id || "preview") +
              "&item=" +
              itemId,
          ),
      );
    }
  };

  const act = async (action: string, values: Record<string, unknown> = {}) => {
    if (action === "bid" && (!data.user || (!data.owner && !data.registered))) {
      registerToBid(String(values.item || ""));
      return false;
    }
    if (!data.user) {
      window.location.href =
        "/signin-with-chatgpt?return_to=" +
        encodeURIComponent(window.location.pathname + window.location.search);
      return false;
    }
    if (data.demo && action !== "create") {
      setModal("create");
      return false;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: data.id,
          key: crypto.randomUUID(),
          ...values,
        }),
      });
      const d = (await r.json()) as {
        id?: string;
        error?: string;
        registerUrl?: string;
      };
      if (!r.ok) {
        if (d.registerUrl) {
          window.location.assign(d.registerUrl);
          return false;
        }
        throw Error(d.error);
      }
      if (d.id) {
        setId(d.id);
        window.history.replaceState({}, "", "?auction=" + d.id);
      }
      await load(d.id || data.id);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const openItem = (item: Item) => {
    setSelected(item);
    setAmount(
      String(
        (item.leading
          ? item.myMax + item.increment
          : item.bidCount
            ? item.price + item.increment
            : item.start) / 100,
      ),
    );
  };
  const countdown = (end: number) => {
    if (!now) return "7 days remaining";
    const t = Math.max(0, Math.floor((end - now) / 1000));
    return t === 0
      ? "Auction closed"
      : `${Math.floor(t / 86400)}d ${Math.floor((t % 86400) / 3600)}h ${Math.floor((t % 3600) / 60)}m`;
  };
  const items = a.items
    .filter(
      (i) =>
        (category === "All items" || i.category === category) &&
        `${i.title} ${i.donor}`.toLowerCase().includes(search.toLowerCase()) &&
        (view !== "Watchlist" || a.watches.includes(i.id)) &&
        (view !== "My bids" || i.myMax > 0),
    )
    .sort((x, y) =>
      sort === "low"
        ? x.price - y.price
        : sort === "high"
          ? y.price - x.price
          : sort === "closing"
            ? x.ends - y.ends
            : 0,
    );
  const current = selected
    ? a.items.find((i) => i.id === selected.id) || selected
    : null;
  function exportReport() {
    const rows = [
      ["Item", "Category", "Current bid USD", "Bidders", "Status"],
      ...a.items.map((i) => [
        i.title,
        i.category,
        String(i.price / 100),
        String(i.bidCount),
        i.sold ? "Reserved" : i.leading ? "Leading" : "Open",
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const u = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = u;
    link.download = "gather-auction-report.csv";
    link.click();
    URL.revokeObjectURL(u);
  }
  return (
    <SidebarProvider>
      <Toaster richColors />
      <Sidebar className="border-r border-[#e5e9e8]">
        <SidebarHeader className="px-6 pt-8 pb-7">
          <a
            href="/"
            className="flex items-center gap-2 text-[30px] font-semibold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-[#175b47] text-white">
              <Leaf size={22} />
            </span>
            gather<span className="text-[#78a68b]">.</span>
          </a>
        </SidebarHeader>
        <SidebarContent className="px-4">
          {!bidderMode ? (
            <div className="rounded-xl border bg-white px-3 py-3 mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Your fundraiser
              </p>
              <Select
                value={data.id || "preview"}
                onValueChange={(v) => {
                  if (v === "new") setModal("create");
                  else {
                    setId(v);
                    window.history.replaceState({}, "", "?auction=" + v);
                    load(v);
                  }
                }}
              >
                <SelectTrigger className="border-0 shadow-none p-0 w-full font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preview">Demo auction</SelectItem>
                  {data.list.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Create an auction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <a
              href={data.nonprofit ? `/n/${data.nonprofit.slug}` : "/"}
              className="block rounded-xl border p-4 mb-6 text-sm font-semibold"
            >
              {data.nonprofit?.name || a.organization}
              <span className="block font-normal text-muted-foreground mt-1">
                Back to nonprofit page →
              </span>
            </a>
          )}
          <p className="eyebrow px-3 mb-3">THE AUCTION</p>
          <SidebarMenu>
            {[
              ["Explore auction", LayoutGrid],
              ["My bids", Gavel],
              ["Watchlist", Heart],
              ["Notifications", Bell],
            ].map(([name, Icon]: any) => (
              <SidebarMenuItem key={name}>
                <SidebarMenuButton
                  onClick={() => setView(name)}
                  isActive={view === name}
                  className="h-11 rounded-lg px-3 text-[14px] mb-1 data-[active=true]:bg-[#e3efe8] data-[active=true]:text-[#175b47]"
                >
                  <Icon />
                  <span>{name}</span>
                  {name === "Watchlist" && a.watches.length > 0 && (
                    <span className="ml-auto">{a.watches.length}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          {!bidderMode && (
            <>
              <p className="eyebrow px-3 mt-9 mb-3">ORGANIZER</p>
              <SidebarMenu>
                {[
                  ["Overview", ChartNoAxesCombined],
                  ["Manage items", Package],
                  ["Nonprofit page", Leaf],
                  ["Settings", Settings],
                ].map(([name, Icon]: any) => (
                  <SidebarMenuItem key={name}>
                    <SidebarMenuButton
                      onClick={() => setView(name)}
                      isActive={view === name}
                      className="h-11 px-3 text-[14px] data-[active=true]:bg-[#e3efe8]"
                    >
                      <Icon />
                      <span>{name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </>
          )}
          <div className="mt-auto mx-1 p-4 rounded-xl bg-[#eaf1ed]">
            <Gift className="text-[#175b47] mb-3" size={22} />
            <p className="font-semibold text-sm">
              A little generosity.
              <br />A lasting difference.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Every bid supports your community.
            </p>
            <button
              onClick={() => setModal("donate")}
              className="text-sm font-semibold mt-4 flex gap-2 items-center text-[#175b47]"
            >
              Make a donation <ArrowUpRight size={16} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter className="p-5 border-t mt-5">
          <button
            onClick={() =>
              data.user
                ? setModal("account")
                : window.location.assign("/signin-with-chatgpt?return_to=/")
            }
            className="flex items-center gap-3 text-left"
          >
            <span className="rounded-full size-9 bg-[#e6e8df] flex items-center justify-center text-sm font-semibold">
              {data.user?.name.slice(0, 1).toUpperCase() || "G"}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate max-w-36">
                {data.user?.name || "Welcome, guest"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {data.user ? "Your account" : "Sign in to participate"}
              </span>
            </span>
            <ChevronRight size={15} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#f8faf9] min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-white/95 px-4 backdrop-blur lg:h-[76px] lg:px-9">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Fundraisers
            </span>
            <ChevronRight
              size={14}
              className="hidden text-muted-foreground sm:block"
            />
            <span className="truncate text-sm font-medium">{a.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 sm:inline">
              Test auction
            </span>
            <button
              className="grid size-11 place-items-center rounded-full sm:size-9"
              aria-label="Notifications"
              onClick={() => setView("Notifications")}
            >
              <Bell size={19} />
            </button>
            <Button
              onClick={() => setModal("donate")}
              size="sm"
              className="bg-[#175b47] hover:bg-[#104532] gap-2"
            >
              <Heart size={15} />
              <span className="hidden min-[380px]:inline">Donate</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1550px] px-4 py-5 pb-28 sm:p-5 sm:pb-28 lg:p-9 lg:pb-10">
          <div className="mb-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 shrink-0" size={15} /> Private
            preview · Test activity only. No money is collected.
          </div>
          {error && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 rounded-xl mb-5"
            >
              {error}{" "}
              <button className="underline" onClick={() => load(id)}>
                Try again
              </button>
            </div>
          )}
          {["Explore auction", "Watchlist", "My bids"].includes(view) ? (
            <>
              <section className="campaign">
                <div>
                  <p className="eyebrow text-[#abd2b7] mb-4">
                    BID WITH HEART. GIVE WITH PURPOSE.
                  </p>
                  <h1>
                    {view === "Explore auction" ? a.name : view}
                    <span className="text-[#cce8b7]">
                      {view === "Explore auction" ? "." : ""}
                    </span>
                  </h1>
                  <p className="text-[#d4e2da] mt-3 max-w-lg text-base">
                    {view === "Explore auction"
                      ? "Extraordinary finds. A stronger community. Discover something you love and make a difference."
                      : view === "Watchlist"
                        ? "Keep the things you love close. Your saved items are all here."
                        : "Follow your bids and see where you stand."}
                  </p>
                  <div className="mt-6 flex gap-3 items-center text-sm">
                    <span className="size-8 rounded-full border border-white/30 flex items-center justify-center">
                      <Leaf size={16} />
                    </span>
                    <span>
                      Supporting{" "}
                      <strong className="font-medium">{a.organization}</strong>
                    </span>
                  </div>
                </div>
                <div className="campaign-status">
                  <div className="flex justify-between items-center gap-6 text-sm">
                    <span className="bg-white/10 px-3 py-1.5 rounded-full">
                      {a.paused ? "Bidding paused" : "Open for test bids"}
                    </span>
                    <Clock size={17} />
                  </div>
                  <p className="text-[27px] font-medium mt-5 tracking-tight">
                    {countdown(a.ends)}
                  </p>
                  <p className="text-sm text-[#c5dacd] mt-1">
                    Until the auction closes
                  </p>
                  <div className="border-t border-white/20 mt-5 pt-4 text-sm flex justify-between">
                    <span>Find your next favorite</span>
                    <ArrowUpRight size={18} />
                  </div>
                </div>
              </section>
              <section className="my-5 grid grid-cols-2 overflow-hidden rounded-2xl border bg-white [&>*]:border-b [&>*]:border-r lg:my-7 lg:grid-cols-4 lg:[&>*]:border-b-0">
                <Stat
                  label="Test commitments"
                  value={money(a.total)}
                  sub={`of ${money(a.goal)} goal`}
                >
                  <Progress
                    value={Math.min(100, (a.total / a.goal) * 100)}
                    className="h-1.5 mt-3 bg-[#e5eee8]"
                  />
                </Stat>
                <Stat
                  label="Items to discover"
                  value={String(a.items.length)}
                  sub="Generously donated"
                />
                <Stat
                  label="Bids placed"
                  value={String(a.bidCount)}
                  sub="Every bid makes an impact"
                />
                <Stat
                  label="Supporters"
                  value={String(a.supporters)}
                  sub="Giving together"
                />
              </section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow mb-1 text-[#6b7f72]">
                    GOOD FINDS. GREATER IMPACT.
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {view === "Explore auction" ? "Discover the auction" : view}
                  </h2>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {items.length} items
                </span>
              </div>
              <div className="mb-4 grid gap-3 sm:flex sm:justify-between">
                <div className="relative w-full sm:w-80">
                  <Search
                    className="absolute left-3 top-3 text-muted-foreground"
                    size={17}
                  />
                  <Input
                    aria-label="Search items"
                    placeholder="Search items or donors"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 bg-white pl-10"
                  />
                </div>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-11 w-full bg-white sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured first</SelectItem>
                    <SelectItem value="low">Price: low to high</SelectItem>
                    <SelectItem value="high">Price: high to low</SelectItem>
                    <SelectItem value="closing">Closing soon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Tabs
                value={category}
                onValueChange={setCategory}
                className="scrollbar-none -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              >
                <TabsList className="h-auto min-w-max gap-2 bg-transparent p-0">
                  {categories.map((c) => (
                    <TabsTrigger
                      key={c}
                      value={c}
                      className="min-h-11 rounded-full border bg-white px-4 py-2.5 data-[state=active]:border-[#175b47] data-[state=active]:bg-[#175b47] data-[state=active]:text-white"
                    >
                      {c}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {items.map((item, n) => (
                  <article key={item.id} className="item-card group">
                    <div className="relative aspect-[1.48] bg-[#e7eeea]">
                      <button
                        onClick={() => openItem(item)}
                        className="size-full"
                        aria-label={"View " + item.title}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <Gift className="mx-auto text-[#648371]" size={50} />
                        )}
                      </button>
                      <span className="absolute left-3 top-3 text-xs bg-white/95 px-2.5 py-1.5 rounded-md font-medium">
                        {item.sold
                          ? "Reserved"
                          : item.leading
                            ? "You’re leading"
                            : item.buyNow
                              ? "Buy now available"
                              : n === 0
                                ? "Featured experience"
                                : item.category}
                      </span>
                      <button
                        disabled={busy}
                        aria-label={
                          (a.watches.includes(item.id)
                            ? "Remove from"
                            : "Add to") +
                          " watchlist: " +
                          item.title
                        }
                        onClick={() => act("watch", { item: item.id })}
                        className="absolute top-3 right-3 bg-white rounded-full size-8 grid place-items-center text-[#175b47]"
                      >
                        <Heart
                          size={16}
                          fill={
                            a.watches.includes(item.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </div>
                    <div className="p-5">
                      <p className="eyebrow text-[#6b7f72] mb-2">
                        {item.category}
                      </p>
                      <button
                        onClick={() => openItem(item)}
                        className="text-left text-lg font-semibold tracking-tight hover:text-[#175b47]"
                      >
                        {item.title}
                      </button>
                      <p className="text-sm text-muted-foreground mt-1">
                        Donated by {item.donor}
                      </p>
                      {!!sponsorData?.itemSponsors[item.id]?.length && (
                        <p className="mt-2 text-xs font-semibold text-[#175b47]">
                          Sponsored by {sponsorData.itemSponsors[item.id].map((sponsor) => sponsor.name).join(", ")}
                        </p>
                      )}
                      <div className="flex justify-between items-end mt-5 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {item.bidCount ? "Current bid" : "Starting bid"}
                          </p>
                          <p className="text-2xl font-semibold">
                            {money(item.price)}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {item.bidCount} bids
                        </span>
                      </div>
                      <Button
                        onClick={() => openItem(item)}
                        variant="outline"
                        className="w-full border-[#c8d7cd] text-[#175b47] hover:bg-[#175b47] hover:text-white h-10 justify-between"
                      >
                        {item.sold ? "View item" : "View & bid"}
                        <ArrowRight size={16} />
                      </Button>
                      <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock size={13} />
                        {countdown(item.ends)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              {items.length === 0 && (
                <div className="text-center border border-dashed rounded-xl py-16">
                  <Heart className="mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    {view === "Watchlist"
                      ? "Your next favorite is waiting"
                      : view === "My bids"
                        ? "Your bidding journey starts here"
                        : "No matching items"}
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    {view === "Explore auction"
                      ? "Try another search or category."
                      : "Explore the auction to find something you love."}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setView("Explore auction");
                      setSearch("");
                      setCategory("All items");
                    }}
                  >
                    Explore all items
                  </Button>
                </div>
              )}
              <div className="rounded-xl bg-[#eaf1ed] p-6 mt-8 flex flex-wrap justify-between gap-5 items-center">
                <div className="flex gap-4 items-center">
                  <Heart className="text-[#175b47]" size={30} />
                  <div>
                    <h3 className="font-semibold">
                      Nothing catch your eye? You can still make a difference.
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Support the mission with a direct donation.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setModal("donate")}
                  className="bg-[#175b47]"
                >
                  Give a little good <ArrowUpRight size={16} />
                </Button>
              </div>
            </>
          ) : view === "Notifications" ? (
            <>
              <PageTitle
                title="Your notifications"
                description="Bid updates, all in one place."
              />
              {a.notifications.length ? (
                a.notifications.map((n, i) => (
                  <div key={i} className="panel flex items-center gap-4 mb-3">
                    <Bell size={20} />
                    <div>
                      <p>{n.message}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(n.at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="panel text-center py-16">
                  <Bell className="mx-auto mb-4" />
                  <h2 className="font-semibold">You’re all caught up</h2>
                  <p className="text-muted-foreground mt-2">
                    Outbid updates appear here. Email and SMS delivery are not
                    connected.
                  </p>
                </div>
              )}
            </>
          ) : view === "Nonprofit page" ? (
            <NonprofitSettings
              nonprofit={data.nonprofit || null}
              auctionId={data.id}
              owner={data.owner}
              onSaved={() => load(id)}
            />
          ) : view === "Overview" ? (
            <>
              <PageTitle
                title="Your auction at a glance"
                description="Keep your fundraiser moving forward."
              />
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <div className="panel">
                  <Stat
                    label="Test commitments"
                    value={money(a.total)}
                    sub="No payments collected"
                  />
                </div>
                <div className="panel">
                  <Stat
                    label="Auction items"
                    value={String(a.items.length)}
                    sub="Across all categories"
                  />
                </div>
                <div className="panel">
                  <Stat
                    label="Participating bidders"
                    value={String(a.supporters)}
                    sub={`${a.bidCount} bids so far`}
                  />
                </div>
              </div>
              <div className="panel mb-6">
                <div className="flex justify-between mb-4">
                  <h2 className="font-semibold">Fundraising goal</h2>
                  <span>
                    {money(a.total)} / {money(a.goal)}
                  </span>
                </div>
                <Progress value={Math.min(100, (a.total / a.goal) * 100)} />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="panel">
                  <h2 className="font-semibold mb-4">
                    Ready for your own fundraiser?
                  </h2>
                  <p className="text-muted-foreground mb-5">
                    Create a private test auction for your nonprofit. Manage
                    items, explore bidding, and review results.
                  </p>
                  <Button onClick={() => setModal("create")}>
                    <Plus size={16} />
                    Create an auction
                  </Button>
                </div>
                <div className="panel">
                  <h2 className="font-semibold mb-4">
                    Before collecting real funds
                  </h2>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li>
                      Connect payment processing and verified nonprofit payouts.
                    </li>
                    <li>Set up public bidder accounts, email, and SMS.</li>
                    <li>
                      Complete security, load, and end-to-end payment checks.
                    </li>
                  </ul>
                </div>
              </div>
            </>
          ) : view === "Manage items" ? (
            <>
              <PageTitle
                title="Manage auction items"
                description="A thoughtful collection for a meaningful cause."
              />
              <div className="flex gap-3 mb-6">
                <Button
                  onClick={() =>
                    data.owner ? setModal("item") : setModal("create")
                  }
                >
                  <Plus size={16} />
                  Add an item
                </Button>
                <Button variant="outline" onClick={exportReport}>
                  <Download size={16} />
                  Export CSV
                </Button>
              </div>
              <div className="panel p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Current bid</TableHead>
                      <TableHead>Bidders</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {a.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="pl-5 py-5 font-medium">
                          <button onClick={() => openItem(i)}>{i.title}</button>
                        </TableCell>
                        <TableCell>{i.category}</TableCell>
                        <TableCell>{money(i.value)}</TableCell>
                        <TableCell>{money(i.price)}</TableCell>
                        <TableCell>{i.bidCount}</TableCell>
                        <TableCell>
                          {i.sold
                            ? "Reserved"
                            : a.paused
                              ? "Paused"
                              : now >= i.ends
                                ? "Closed"
                                : "Open"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <>
              <PageTitle
                title="Auction settings"
                description="Make this fundraiser your own."
              />
              <form
                className="panel max-w-2xl space-y-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await act("settings", {
                      name: f.get("name"),
                      organization: f.get("organization"),
                    })
                  )
                    toast.success("Settings saved");
                }}
              >
                <Field label="Auction name">
                  <Input
                    name="name"
                    key={a.name}
                    defaultValue={a.name}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="Nonprofit name">
                  <Input
                    name="organization"
                    key={a.organization}
                    defaultValue={a.organization}
                    required
                    maxLength={100}
                  />
                </Field>
                <div className="flex items-center justify-between border-t pt-5">
                  <div>
                    <p className="font-medium">Pause bidding</p>
                    <p className="text-sm text-muted-foreground">
                      Temporarily stop new bids and test purchases.
                    </p>
                  </div>
                  <Switch
                    checked={a.paused}
                    disabled={!data.owner || busy}
                    onCheckedChange={(paused) => act("settings", { paused })}
                    aria-label="Pause bidding"
                  />
                </div>
                <Button disabled={!data.owner || busy}>Save changes</Button>
                {!data.owner && (
                  <p className="text-sm text-muted-foreground">
                    Create your own auction to edit settings.
                  </p>
                )}
              </form>
            </>
          )}
          <SponsorShowcase data={sponsorData} />
          <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
            <span>Gather · Good things happen when we give together.</span>
            <button
              onClick={() => setModal("about")}
              className="underline underline-offset-4"
            >
              About this test auction & photo credits
            </button>
          </footer>
        </main>
        <nav
          aria-label="Auction navigation"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(23,76,59,.08)] backdrop-blur md:hidden"
        >
          {[
            ["Explore auction", LayoutGrid, "Explore"],
            ["My bids", Gavel, "My bids"],
            ["Watchlist", Heart, "Saved"],
          ].map(([name, Icon, label]: any) => (
            <button
              key={name}
              onClick={() => setView(name)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium ${view === name ? "text-[#175b47]" : "text-muted-foreground"}`}
            >
              <Icon
                size={20}
                fill={
                  name === "Watchlist" && a.watches.length
                    ? "currentColor"
                    : "none"
                }
              />
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setModal("donate")}
            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground"
          >
            <Gift size={20} />
            <span>Donate</span>
          </button>
        </nav>
      </SidebarInset>
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto p-0 gap-0">
          <DialogHeader className="p-6 pb-3">
            <p className="eyebrow text-[#648371]">
              {current?.category} · Item #{current?.id.slice(0, 8)}
            </p>
            <DialogTitle className="text-2xl">{current?.title}</DialogTitle>
            <DialogDescription>Donated by {current?.donor}</DialogDescription>
            {current && !!sponsorData?.itemSponsors[current.id]?.length && (
              <p className="text-sm font-semibold text-[#175b47]">
                Sponsored by {sponsorData.itemSponsors[current.id].map((sponsor) => sponsor.name).join(", ")}
              </p>
            )}
          </DialogHeader>
          {current && (
            <div className="p-6 pt-2">
              {current.image && (
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-52 object-cover rounded-lg mb-5"
                />
              )}
              <p className="text-muted-foreground">{current.description}</p>
              <div className="grid grid-cols-3 gap-3 my-5 border-y py-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current bid</p>
                  <p className="font-semibold text-xl">
                    {money(current.price)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Estimated value
                  </p>
                  <p className="font-semibold text-xl">
                    {money(current.value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time left</p>
                  <p className="font-medium">{countdown(current.ends)}</p>
                </div>
              </div>
              {current.myMax > 0 && (
                <p className="p-3 rounded-lg bg-[#eaf1ed] mb-4 text-sm">
                  {current.leading ? "You’re leading." : "You’ve been outbid."}{" "}
                  Your private maximum: {money(current.myMax)}.
                </p>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act("bid", {
                      item: current.id,
                      amount: Math.round(Number(amount) * 100),
                    })
                  ) {
                    toast.success("Test bid recorded");
                    setSelected(null);
                  }
                }}
              >
                <Field label="Your maximum bid (USD)">
                  <Input
                    type="number"
                    min={
                      (current.leading
                        ? current.myMax + current.increment
                        : current.bidCount
                          ? current.price + current.increment
                          : current.start) / 100
                    }
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <p className="text-xs text-muted-foreground mt-2 mb-4">
                  We bid only as much as needed, up to your maximum. Earlier
                  bids win ties. Last-minute bids extend closing by two minutes.
                </p>
                <Button
                  className="w-full h-11"
                  disabled={
                    busy || current.sold || now >= current.ends || a.paused
                  }
                >
                  {busy
                    ? "Saving…"
                    : current.sold
                      ? "Item reserved"
                      : !data.user || (!data.owner && !data.registered)
                        ? "Sign up to bid"
                        : "Place test bid"}
                </Button>
              </form>
              {current.buyNow > 0 && !current.sold && (
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  disabled={busy || now >= current.ends || a.paused}
                  onClick={async () => {
                    if (await act("buy", { item: current.id })) {
                      toast.success(
                        "Test reservation recorded. No charge was made.",
                      );
                      setSelected(null);
                    }
                  }}
                >
                  Test buy now · {money(current.buyNow)}
                </Button>
              )}
              <a
                href={`/messages?auction=${encodeURIComponent(data.id || "")}&item=${encodeURIComponent(current.id)}&subject=${encodeURIComponent(current.title)}`}
                className="mt-4 block min-h-11 content-center rounded-md border text-center text-sm font-semibold text-[#175b47] hover:bg-[#f4f7f5]"
              >
                Ask the organizer a question
              </a>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Test activity only. No payment or purchase obligation.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o) setModal("");
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {modal === "create"
                ? "Create your test auction"
                : modal === "donate"
                  ? "Give a little good"
                  : modal === "item"
                    ? "Add an auction item"
                    : modal === "account"
                      ? "Your account"
                      : "About this preview"}
            </DialogTitle>
            <DialogDescription>
              {modal === "create"
                ? "Your own private workspace, with sample items to get started."
                : modal === "donate"
                  ? "Record a test donation to explore the giving experience."
                  : modal === "item"
                    ? "Tell bidders what makes this donation special."
                    : modal === "account"
                      ? "Signed in through ChatGPT."
                      : "A working foundation for nonprofit silent auctions."}
            </DialogDescription>
          </DialogHeader>
          {modal === "create" ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await act("create", {
                    name: f.get("name"),
                    organization: f.get("organization"),
                    ...(f.get("reuse") === "yes" && data.nonprofit
                      ? { nonprofitId: data.nonprofit.id }
                      : {}),
                  })
                ) {
                  setModal("");
                  toast.success("Your test auction is ready");
                }
              }}
            >
              <Field label="Nonprofit name">
                <Input
                  name="organization"
                  defaultValue={data.nonprofit?.name || ""}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Your nonprofit"
                />
              </Field>
              <Field label="Auction name">
                <Input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Annual community auction"
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                A dedicated nonprofit page and shareable link are included.
              </p>
              {data.nonprofit && (
                <label className="flex gap-2 text-sm">
                  <input
                    name="reuse"
                    type="checkbox"
                    value="yes"
                    defaultChecked
                  />
                  Add this auction to {data.nonprofit.name}’s existing page
                </label>
              )}
              <Button disabled={busy} className="w-full">
                {data.user ? "Create test auction" : "Sign in to create"}
              </Button>
            </form>
          ) : modal === "donate" ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await act("donate", {
                    amount: Math.round(Number(f.get("amount")) * 100),
                  })
                ) {
                  setModal("");
                  toast.success(
                    "Test donation recorded. No money was collected.",
                  );
                }
              }}
              className="space-y-4"
            >
              <Field label="Donation amount (USD)">
                <Input
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="50"
                  required
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                Supporting {a.organization}. Payment processing is not
                connected; this records a test commitment only.
              </p>
              <Button className="w-full" disabled={busy}>
                Record test donation
              </Button>
            </form>
          ) : modal === "item" ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await act("item", {
                    title: f.get("title"),
                    donor: f.get("donor"),
                    description: f.get("description"),
                    category: f.get("category"),
                    start: Math.round(Number(f.get("start")) * 100),
                    value: Math.round(Number(f.get("value")) * 100),
                  })
                ) {
                  setModal("");
                  toast.success("Item added");
                }
              }}
            >
              <Field label="Item title">
                <Input name="title" minLength={3} maxLength={100} required />
              </Field>
              <Field label="Donated by">
                <Input name="donor" minLength={2} maxLength={100} required />
              </Field>
              <Field label="Category">
                <Select name="category" defaultValue="Experiences">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.slice(1).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description & redemption details">
                <textarea
                  name="description"
                  className="w-full border rounded-md p-3"
                  required
                  minLength={10}
                  maxLength={2000}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Starting bid (USD)">
                  <Input name="start" type="number" min="1" step="1" required />
                </Field>
                <Field label="Estimated value (USD)">
                  <Input name="value" type="number" min="1" step="1" required />
                </Field>
              </div>
              <Button className="w-full" disabled={busy}>
                Add item
              </Button>
            </form>
          ) : modal === "account" ? (
            <div>
              <p className="mb-4 break-all">{data.user?.name}</p>
              <a href="/signout-with-chatgpt?return_to=/" className="underline">
                Sign out
              </a>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                All organizations, donated items, and commitments in the sample
                auction are illustrative. No real payments are collected.
              </p>
              <p>
                Bidding and watchlists save to the server after you create an
                auction. Notifications refresh every 15 seconds. Public
                registration, payment processing, automated receipts, and
                email/SMS need production integration.
              </p>
              <p>
                Photos:{" "}
                <a
                  href="https://unsplash.com/photos/cwUjUE_RJsU"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Ali Kazal
                </a>
                ,{" "}
                <a
                  href="https://unsplash.com/photos/iv6yNy7oBqQ"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Elevate
                </a>
                ,{" "}
                <a
                  href="https://unsplash.com/photos/clADogarw3I"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Greg Rosenke
                </a>
                , and{" "}
                <a
                  href="https://unsplash.com/photos/xa2Q7-KkRjY"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Clay Banks
                </a>{" "}
                on Unsplash.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function Stat({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-5 lg:px-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-[28px] font-semibold tracking-tight mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      {children}
    </div>
  );
}
function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const params = useSearchParams();
  const auction = params.get("auction") || "";
  return (
    <div className="mb-7">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      {title === "Manage auction items" && (
        <div className="mt-5 inline-flex rounded-lg border bg-white p-1">
          <span className="rounded-md bg-[#175b47] px-4 py-2 text-sm font-medium text-white">
            Auction items
          </span>
          <a
            className="rounded-md px-4 py-2 text-sm font-medium"
            href={`/admin/experiences${auction ? `?auction=${encodeURIComponent(auction)}` : ""}`}
          >
            Give Holidays Experiences
          </a>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-2">{label}</span>
      {children}
    </label>
  );
}
