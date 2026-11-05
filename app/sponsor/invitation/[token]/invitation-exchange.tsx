"use client";

import { useEffect, useState } from "react";
import { Leaf, LoaderCircle, ShieldCheck } from "lucide-react";

export default function InvitationExchange({ token }: { token: string }) {
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/sponsors/portal/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const value = (await response.json()) as { redirect?: string; error?: string };
        if (!response.ok || !value.redirect) throw Error(value.error || "Unable to open invitation.");
        window.location.replace(value.redirect);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to open invitation."));
  }, [token]);
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8f6] px-5">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eaf3ed] text-[#175b47]">
          {error ? <ShieldCheck size={25} /> : <LoaderCircle className="animate-spin" size={25} />}
        </span>
        <div className="mt-5 flex items-center justify-center gap-2 text-2xl font-semibold text-[#175b47]">
          <Leaf size={20} /> gather<span className="text-[#78a68b]">.</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold">{error ? "Invitation unavailable" : "Opening your secure invitation"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {error || "We’re securely exchanging your one-time invitation link for sponsor portal access."}
        </p>
      </section>
    </main>
  );
}
