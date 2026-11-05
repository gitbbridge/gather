"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Heart,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm({
  returnTo,
  initialMode = "signin",
  initialMessage = "",
}: {
  returnTo: string;
  initialMode?: "signin" | "signup" | "forgot";
  initialMessage?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [accountType, setAccountType] = useState<"organizer" | "supporter">(
    () =>
      returnTo.startsWith("/n/")
        ? "supporter"
        : returnTo.startsWith("/admin") || returnTo.startsWith("/onboarding")
          ? "organizer"
          : "supporter",
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const fullName = String(form.get("fullName") || "").trim();

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/auth/callback?return_to=${encodeURIComponent("/auth/update-password")}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
        setMessage(
          "If an account exists for that email, a password-reset link is on its way. Use the newest link and check your spam folder.",
        );
        return;
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.assign(
          `/auth/complete?return_to=${encodeURIComponent(returnTo)}`,
        );
        return;
      }

      const emailRedirectTo = `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(returnTo)}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: { full_name: fullName, account_type: accountType },
        },
      });
      if (error) throw error;
      if (data.session) {
        window.location.assign(
          `/auth/complete?return_to=${encodeURIComponent(returnTo)}`,
        );
        return;
      }
      setMessage(
        "Check your email to confirm your account, then return here to sign in.",
      );
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to authenticate. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {mode === "forgot" ? (
        <div className="mt-7 rounded-xl bg-[#f5f8f6] p-4">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMessage("");
            }}
            className="flex items-center gap-2 text-sm font-semibold text-[#175b47]"
          >
            <ArrowLeft size={15} />
            Back to sign in
          </button>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Enter your account email and we’ll send a secure password-reset
            link.
          </p>
        </div>
      ) : (
        <div
          className="mt-7 grid grid-cols-2 rounded-lg bg-muted p-1"
          aria-label="Authentication mode"
        >
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMessage("");
            }}
            className={`min-h-10 rounded-md text-sm font-medium ${mode === "signin" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            className={`min-h-10 rounded-md text-sm font-medium ${mode === "signup" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            Create account
          </button>
        </div>
      )}
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <fieldset>
              <legend className="text-sm font-medium">
                I’m joining Gather as
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType("organizer")}
                  className={`rounded-xl border p-3 text-left ${accountType === "organizer" ? "border-[#175b47] bg-[#f0f6f2] ring-1 ring-[#175b47]" : "bg-white"}`}
                >
                  <Building2 size={18} className="text-[#175b47]" />
                  <strong className="mt-2 block text-sm">
                    Nonprofit organizer
                  </strong>
                  <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                    Create and manage fundraising.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("supporter")}
                  className={`rounded-xl border p-3 text-left ${accountType === "supporter" ? "border-[#175b47] bg-[#f0f6f2] ring-1 ring-[#175b47]" : "bg-white"}`}
                >
                  <Heart size={18} className="text-[#175b47]" />
                  <strong className="mt-2 block text-sm">
                    Bidder or donor
                  </strong>
                  <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                    Bid, purchase, and support.
                  </span>
                </button>
              </div>
            </fieldset>
            <label className="block text-sm font-medium">
              Full name
              <Input
                className="mt-2 h-12"
                name="fullName"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          </>
        )}
        <label className="block text-sm font-medium">
          Email
          <Input
            className="mt-2 h-12"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        {mode !== "forgot" && (
          <label className="block text-sm font-medium">
            Password
            <Input
              className="mt-2 h-12"
              name="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              minLength={8}
              required
            />
          </label>
        )}
        {mode === "signin" && (
          <div className="-mt-1 text-right">
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setMessage("");
              }}
              className="text-sm font-medium text-[#175b47] hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}
        <Button className="h-12 w-full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="animate-spin" />
          ) : mode === "forgot" ? (
            <Mail />
          ) : (
            <ArrowRight />
          )}
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
        </Button>
      </form>
      {message && (
        <p
          className={`mt-4 rounded-lg p-3 text-sm leading-6 ${/invalid|expired|unable|could not|error/i.test(message) ? "bg-red-50 text-red-800" : "bg-[#f5f8f6] text-[#244c3e]"}`}
          role="status"
        >
          {message}
        </p>
      )}
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        By continuing, you agree to use Gather responsibly and only on behalf of
        organizations you are authorized to represent.
      </p>
    </>
  );
}
