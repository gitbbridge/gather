'use client';

import { useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function UpdatePasswordForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmation = String(form.get('confirmation') || '');
    if (password !== confirmation) {
      setMessage('The passwords do not match.');
      setBusy(false);
      return;
    }
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      setComplete(true);
      setMessage('Your password has been updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update your password. Request a new reset link and try again.');
    } finally { setBusy(false); }
  };

  if (complete) return <div className="mt-7 rounded-xl bg-emerald-50 p-5 text-emerald-950"><CheckCircle2/><p className="mt-3 font-semibold">Password updated</p><p className="mt-1 text-sm">Your recovery session is active and you can continue securely.</p><Button asChild className="mt-5 w-full"><a href="/admin">Continue to dashboard</a></Button></div>;

  return <form className="mt-7 space-y-4" onSubmit={submit}><label className="block text-sm font-medium">New password<Input className="mt-2 h-12" name="password" type="password" minLength={8} autoComplete="new-password" required/></label><label className="block text-sm font-medium">Confirm new password<Input className="mt-2 h-12" name="confirmation" type="password" minLength={8} autoComplete="new-password" required/></label><Button className="h-12 w-full" disabled={busy}>{busy ? <LoaderCircle className="animate-spin"/> : <CheckCircle2/>}{busy ? 'Updating…' : 'Update password'}</Button>{message && <p className="text-sm leading-6 text-red-700" role="alert">{message}</p>}</form>;
}
