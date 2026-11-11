"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient, type SupabaseBrowserConfig } from "@/lib/supabase/client";
import { toast, Toaster } from "sonner";

type Enrollment = { id: string; qr: string; secret: string };

export default function SecurityClient({ supabaseConfig }: { supabaseConfig: SupabaseBrowserConfig }) {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [aal, setAal] = useState("aal1");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient(supabaseConfig);
    const [{ data: factors, error }, { data: assurance }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (error) throw error;
    setVerified((factors?.totp || []).some((factor) => factor.status === "verified"));
    setAal(assurance?.currentLevel || "aal1");
    setLoading(false);
  }, [supabaseConfig]);

  // The initial security-state request intentionally hydrates this client view.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh().catch((error) => { toast.error(error.message); setLoading(false); }); }, [refresh]);

  const beginEnrollment = async () => {
    setBusy(true);
    try {
      const { data, error } = await createSupabaseBrowserClient(supabaseConfig).auth.mfa.enroll({ factorType: "totp", friendlyName: "Gather Authenticator" });
      if (error) throw error;
      setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to start MFA enrollment."); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!enrollment || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient(supabaseConfig);
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId: enrollment.id, challengeId: challenge.id, code });
      if (error) throw error;
      setEnrollment(null); setCode(""); await refresh(); toast.success("Multi-factor authentication is active.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "That code could not be verified."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#f4f8f5]"><Toaster richColors/>
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link href="/admin" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/>Dashboard</Link><span className="text-2xl font-semibold text-[#175b47]">gather<span className="text-[#78a68b]">.</span></span></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9"><p className="eyebrow text-muted-foreground">ACCOUNT PROTECTION</p><h1 className="mt-2 text-3xl font-semibold">Gather Security Center</h1><p className="mt-2 max-w-2xl leading-7 text-muted-foreground">Protect organizer access and review the controls that safeguard auction, supporter, and payment records.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-2xl border bg-white p-6"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#eaf2ed] text-[#175b47]"><Smartphone size={21}/></span><div><h2 className="font-semibold">Authenticator app</h2><p className="mt-1 text-sm text-muted-foreground">Required protection for sensitive organizer actions.</p></div></div>{loading?<LoaderCircle className="animate-spin text-muted-foreground" size={18}/>:<Status good={verified} label={verified?"Enabled":"Not enabled"}/>}</div>
          {!loading&&!verified&&!enrollment&&<><p className="mt-6 text-sm leading-6 text-muted-foreground">Use Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP-compatible app.</p><Button className="mt-5" disabled={busy} onClick={beginEnrollment}><KeyRound size={16}/>Set up MFA</Button></>}
          {enrollment&&<div className="mt-6 border-t pt-6"><p className="text-sm font-semibold">1. Scan this QR code</p><img src={enrollment.qr} alt="Authenticator QR code" className="mt-3 size-48 rounded-xl border bg-white p-2"/><details className="mt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Can’t scan? Show setup key</summary><code className="mt-2 block break-all rounded-lg bg-muted p-3">{enrollment.secret}</code></details><label className="mt-5 block text-sm font-medium">2. Enter the six-digit code<Input className="mt-2 max-w-56" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,""))}/></label><Button className="mt-4" disabled={busy||code.length!==6} onClick={verify}>{busy?<LoaderCircle className="animate-spin" size={16}/>:<ShieldCheck size={16}/>}Verify and enable</Button></div>}
          {verified&&<div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><strong>MFA is enrolled.</strong> Your current session assurance is <code>{aal}</code>. Gather will progressively require a fresh MFA challenge for financial and account-administration actions.</div>}
        </section>
        <section className="rounded-2xl border bg-white p-6"><div className="flex items-center gap-3"><LockKeyhole className="text-[#175b47]" size={22}/><h2 className="font-semibold">Platform safeguards</h2></div><div className="mt-6 divide-y">{[
          ["Database isolation","Row-Level Security and server-only financial tables"],
          ["Payment protection","Stripe-hosted card entry, signed webhooks, and idempotent operations"],
          ["Abuse prevention","Server-side throttling on bids, checkout, email, and secure-link exchange"],
          ["Browser protection","CSP, HSTS, anti-clickjacking, MIME-sniffing, and privacy headers"],
          ["Operational records","Append-only audit trails for consequential auction actions"],
        ].map(([title,detail])=><div key={title} className="flex gap-3 py-4 first:pt-0"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18}/><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p></div></div>)}</div></section>
      </div>
      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Security reminder</h2><p className="mt-2 text-sm leading-6 text-amber-900">Gather staff will never ask for your password, authenticator code, full card number, Stripe secret key, or Supabase secret key. Report suspicious requests to support@gatherforgood.bid.</p></section>
    </div>
  </main>;
}

function Status({good,label}:{good:boolean;label:string}) { return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${good?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900"}`}>{label}</span>; }

