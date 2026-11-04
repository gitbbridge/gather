'use client';

import { useState } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function ResendTestButton() {
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    setSending(true);
    try {
      const response = await fetch('/api/admin/email-templates/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId: 'payment-receipt' }),
      });
      const result = await response.json() as { error?: string; recipient?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to send the test email.');
      toast.success(`Resend test sent to ${result.recipient}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send the test email.');
    } finally {
      setSending(false);
    }
  };

  return <Button size="sm" onClick={sendTest} disabled={sending}>{sending ? <LoaderCircle className="animate-spin" size={15}/> : <Send size={15}/>}Send Resend test</Button>;
}
