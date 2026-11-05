'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, LoaderCircle, Printer, ReceiptText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EventSettlement, SettlementLedgerRow } from '@/lib/settlement';
import { toast, Toaster } from 'sonner';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const statusTone = (status: string) => status === 'Paid' || status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : status.includes('Refund') ? 'bg-violet-50 text-violet-700' : status === 'Failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800';

export default function SettlementClient({ auctionId }: { auctionId: string }) {
  const [data, setData] = useState<EventSettlement | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState('All');
  const [fulfillment, setFulfillment] = useState('All');
  const [category, setCategory] = useState('All');
  const [sendingReceipt, setSendingReceipt] = useState('');
  useEffect(() => {
    if (!auctionId) return;
    fetch(`/api/settlement?auction=${encodeURIComponent(auctionId)}`).then(async response => {
      const body = await response.json() as EventSettlement & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to load settlement.');
      setData(body);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load settlement.'));
  }, [auctionId]);
  const categories = useMemo(() => [...new Set((data?.ledger || []).map(row => row.category))].sort(), [data]);
  const rows = useMemo(() => (data?.ledger || []).filter(row => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [row.itemName, row.bidderName, row.bidderEmail].some(value => value.toLowerCase().includes(query));
    return matchesSearch && (payment === 'All' || row.paymentStatus === payment) && (fulfillment === 'All' || row.fulfillmentStatus === fulfillment) && (category === 'All' || row.category === category);
  }), [data, search, payment, fulfillment, category]);
  if (!auctionId) return <Empty title="Choose an auction" copy="Open Event Settlement from an auction dashboard." />;
  if (error) return <Empty title="Settlement unavailable" copy={error} />;
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#f8faf9]"><div className="flex items-center gap-3 text-muted-foreground"><LoaderCircle className="animate-spin" />Building verified settlement…</div></main>;
  const s = data.summary;
  const resendReceipt = async (row: SettlementLedgerRow) => {
    if (!row.invoiceId || sendingReceipt) return;
    setSendingReceipt(row.invoiceId);
    try {
      const response = await fetch('/api/settlement/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auctionId, invoiceId: row.invoiceId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to resend receipt.');
      toast.success(`Receipt resent to ${row.bidderEmail}`);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to resend receipt.'); }
    finally { setSendingReceipt(''); }
  };
  const financial = [
    ['Gross auction proceeds', s.grossAuctionProceedsCents], ['Collected payments', s.collectedPaymentsCents], ['Outstanding winning bids', s.outstandingWinningBidsCents],
    ['Failed payments', s.failedPaymentsCents], ['Refunds', s.refundsCents], ['Platform commission', s.platformCommissionCents],
    ['Paid by bidders', s.bidderCommissionCents], ['Paid by nonprofit', s.nonprofitCommissionCents], ['Payment-processing fees', s.processingFeesCents],
    ['Travel supplier costs', s.travelSupplierCostsCents], ['Give Holidays markup', s.travelMarkupCents], ['Net proceeds to nonprofit', s.netProceedsCents],
  ] as const;
  return <main className="min-h-screen bg-[#f8faf9] px-4 py-6 print:bg-white sm:px-7 lg:px-10">
    <Toaster richColors />
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><a href={`/admin?auction=${encodeURIComponent(auctionId)}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground print:hidden"><ArrowLeft size={15}/>Auction dashboard</a><p className="eyebrow mt-6 text-muted-foreground">EVENT SETTLEMENT</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.auction.name}</h1><p className="mt-2 text-muted-foreground">A verified view of what the auction raised, what was collected, and what the nonprofit receives.</p></div>
        <div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" asChild><a href={`/closeout?auction=${encodeURIComponent(auctionId)}`}>Review winners & invoices</a></Button><Button variant="outline" onClick={() => window.print()}><Printer size={16}/>Print settlement</Button><Button asChild><a href={`/api/settlement?auction=${encodeURIComponent(auctionId)}&format=csv`}><Download size={16}/>Download Final Settlement CSV</a></Button></div>
      </header>

      <section className="mt-8 overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">Financial summary</h2><p className="mt-1 text-sm text-muted-foreground">Gross proceeds are winning bids. Net proceeds subtract the nonprofit share of fees, processing, refunds, and travel economics.</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{financial.map(([label, value], index) => <div key={label} className={`border-b p-5 sm:border-r ${index === financial.length - 1 ? 'bg-[#eef5f1]' : ''}`}><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold ${index === financial.length - 1 ? 'text-[#175b47]' : ''}`}>{money(value)}</p></div>)}</div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Sold items" value={`${s.soldItems} of ${s.listedItems}`} />
        <Metric label="Paid winners" value={String(s.paidWinners)} />
        <Metric label="Average winning bid" value={money(s.averageWinningBidCents)} />
        <Metric label="Sell-through rate" value={`${s.sellThroughPercent.toFixed(1)}%`} />
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5"><div className="flex items-center gap-2"><ReceiptText size={18} className="text-[#175b47]"/><h2 className="font-semibold">Item-by-item reconciliation</h2></div><div className="mt-4 grid gap-3 print:hidden md:grid-cols-2 xl:grid-cols-4"><label className="relative"><Search className="absolute left-3 top-3 text-muted-foreground" size={16}/><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search bidder or item"/></label><Select value={payment} set={setPayment} values={['All','Paid','Unpaid','Failed','Refunded','Partially Refunded']}/><Select value={fulfillment} set={setFulfillment} values={['All','Not Required','Pending','Ready to Release','Released','Completed']}/><Select value={category} set={setCategory} values={['All',...categories]}/></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="bg-[#f5f8f6] text-xs uppercase tracking-wide text-muted-foreground"><tr>{['Item','Category','Winning bidder','Winning bid','Commission','Bidder fee','Nonprofit fee','Processing','Travel cost','Total paid','Payment','Fulfillment','Transaction / receipt','Net proceeds'].map(column => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody className="divide-y">{rows.map(row => <LedgerRow key={row.itemId} row={row} organizationId={data.auction.organizationId || ''} resend={() => resendReceipt(row)} sending={sendingReceipt === row.invoiceId}/>)}</tbody></table></div>
        {!rows.length && <div className="p-10 text-center text-sm text-muted-foreground">No reconciliation rows match these filters.</div>}
      </section>
      <p className="mt-5 text-xs text-muted-foreground">Generated {new Date(data.generatedAt).toLocaleString()}. Unpaid amounts are recognized auction results, not collected cash.</p>
    </div>
  </main>;
}

function LedgerRow({ row, organizationId, resend, sending }: { row: SettlementLedgerRow; organizationId: string; resend: () => void; sending: boolean }) { const canResend=['Paid','Partially Refunded','Refunded'].includes(row.paymentStatus); const supporterUrl=row.supporterId?`/admin/supporters/${row.supporterId}?organization=${encodeURIComponent(organizationId)}`:`/admin/supporters?organization=${encodeURIComponent(organizationId)}&email=${encodeURIComponent(row.bidderEmail)}`; return <tr className="align-top"><td className="px-4 py-4 font-medium">{row.itemName}</td><td className="px-4 py-4 text-muted-foreground">{row.category}</td><td className="px-4 py-4"><a href={row.bidderId ? supporterUrl : '#'} className={row.bidderId ? 'font-medium text-[#175b47] hover:underline' : 'text-muted-foreground'}>{row.bidderName || 'Not sold'}</a><div className="text-xs text-muted-foreground">{row.bidderEmail}</div></td><Money value={row.winningBidCents}/><td className="px-4 py-4">{row.commissionConfiguration}</td><Money value={row.bidderCommissionCents}/><Money value={row.nonprofitCommissionCents}/><Money value={row.processingFeeCents}/><Money value={row.travelSupplierCostCents}/><Money value={row.totalPaidByBidderCents}/><td className="px-4 py-4"><Badge value={row.paymentStatus}/></td><td className="px-4 py-4"><Badge value={row.fulfillmentStatus}/></td><td className="px-4 py-4 text-xs text-muted-foreground"><div>{row.transactionId || '—'}</div><div>{row.receiptId || '—'}</div>{canResend&&<button onClick={resend} disabled={sending} className="mt-2 font-semibold text-[#175b47] hover:underline disabled:opacity-50">{sending?'Sending…':'Resend receipt'}</button>}</td><td className="px-4 py-4 font-semibold text-[#175b47]">{money(row.netProceedsCents)}</td></tr> }
function Money({ value }: { value: number }) { return <td className="px-4 py-4 tabular-nums">{money(value)}</td> }
function Badge({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(value)}`}>{value}</span> }
function Select({ value, set, values }: { value: string; set: (value: string) => void; values: string[] }) { return <select className="h-10 rounded-md border bg-white px-3 text-sm" value={value} onChange={event => set(event.target.value)}>{values.map(option => <option key={option}>{option}</option>)}</select> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div> }
function Empty({ title, copy }: { title: string; copy: string }) { return <main className="grid min-h-screen place-items-center bg-[#f8faf9] p-6"><div className="max-w-md rounded-xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-muted-foreground">{copy}</p><Button asChild className="mt-5"><a href="/admin">Return to dashboard</a></Button></div></main> }
