import { z } from 'zod';
import { managedAuction } from '@/lib/organizer-access';
import { sendInvoiceReceipt } from '@/lib/supabase/receipts';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const input = z.object({ auctionId: z.string().uuid(), invoiceId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: 'Choose a paid transaction.' }, { status: 400 });
    const access = await managedAuction(parsed.data.auctionId);
    if (!access) return Response.json({ error: 'Access denied.' }, { status: 403 });
    const { data: invoice } = await createSupabaseAdminClient().from('winner_invoices').select('id,status').eq('id', parsed.data.invoiceId).eq('auction_id', parsed.data.auctionId).maybeSingle();
    if (!invoice) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (!['paid','partially_refunded','refunded'].includes(invoice.status)) return Response.json({ error: 'Receipts are available only for confirmed payments.' }, { status: 409 });
    return Response.json(await sendInvoiceReceipt(invoice.id, { resend: true }));
  } catch (error) {
    console.error('Unable to resend receipt:', error);
    return Response.json({ error: 'Unable to resend the receipt.' }, { status: 500 });
  }
}
