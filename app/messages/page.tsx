import { requireAppUser } from "@/lib/auth";
import MessagesClient from "./messages-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Messages | Gather",
  description: "Private auction conversations and organizer updates.",
};
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ).toString();
  await requireAppUser(`/messages${query ? `?${query}` : ""}`);
  return <MessagesClient params={params} />;
}
