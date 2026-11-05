import { requireAppUser } from "@/lib/auth";
import { database } from "@/lib/nonprofits";
import { redirect } from "next/navigation";
import { postAuthDestination } from "@/lib/auth-destination";
import { Gavel, Heart, Mail, Trophy } from "lucide-react";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = { title: "Supporter Home | Gather" };
export default async function AccountPage() {
  const user = await requireAppUser("/account");
  const destination = await postAuthDestination(user, "/account");
  if (destination === "/admin") redirect("/admin");
  let organizations: { id: string; slug: string; name: string }[] = [];
  try {
    organizations = (
      await database()
        .prepare(
          "SELECT n.id,n.slug,n.name FROM registrations r JOIN nonprofits n ON n.id=r.nonprofit_id WHERE r.user_id=? ORDER BY r.created_at DESC",
        )
        .bind(user.userId)
        .all<{ id: string; slug: string; name: string }>()
    ).results;
  } catch {}
  return (
    <main className="min-h-screen bg-[#f5f8f6]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </Link>
          <a
            href="/auth/signout?return_to=/"
            className="text-sm text-muted-foreground"
          >
            Sign out
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="eyebrow text-muted-foreground">SUPPORTER HOME</p>
        <h1 className="mt-2 text-3xl font-semibold">
          Welcome, {user.fullName || user.email}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Keep up with auctions you support, your bids, wins, messages, and
          travel experiences.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card
            href="/my-wins"
            icon={<Trophy />}
            title="My wins & purchases"
            copy="Pay winner invoices and track fulfillment."
          />
          <Card
            href="/messages"
            icon={<Mail />}
            title="Messages"
            copy="Read private organizer conversations."
          />
          <Card
            href="/"
            icon={<Heart />}
            title="Discover fundraisers"
            copy="Find another cause to support."
          />
        </div>
        <section className="mt-8 rounded-2xl border bg-white p-6">
          <div className="flex items-center gap-2">
            <Gavel className="text-[#175b47]" />
            <h2 className="text-xl font-semibold">Your nonprofit auctions</h2>
          </div>
          {organizations.length ? (
            <div className="mt-5 divide-y">
              {organizations.map((org) => (
                <a
                  key={org.id}
                  href={`/n/${org.slug}`}
                  className="flex items-center justify-between py-4 font-medium hover:text-[#175b47]"
                >
                  <span>{org.name}</span>
                  <span>Open page →</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-[#f5f8f6] p-6 text-center text-sm text-muted-foreground">
              Once you register for a nonprofit auction, it will appear here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function Card({
  href,
  icon,
  title,
  copy,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="grid size-10 place-items-center rounded-full bg-[#e8f2ed] text-[#175b47]">
        {icon}
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </Link>
  );
}
