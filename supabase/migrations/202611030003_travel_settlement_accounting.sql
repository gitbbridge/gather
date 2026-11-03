-- Give Holidays cost and markup are internal settlement deductions, not bidder
-- surcharges. The winning bidder owes the hammer total plus only their allocated
-- share of Gather's 5% platform commission.

alter table public.winner_invoices
  add column give_holidays_wholesale_cost_cents integer not null default 0
  check (give_holidays_wholesale_cost_cents >= 0);

alter table public.winner_invoice_items
  add column give_holidays_wholesale_cost_cents integer not null default 0
  check (give_holidays_wholesale_cost_cents >= 0);

do $$
declare existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.winner_invoices'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%total_due_cents%';
  if existing_constraint is not null then
    execute format('alter table public.winner_invoices drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.winner_invoices
  add constraint winner_invoices_total_due_check
  check (total_due_cents = hammer_subtotal_cents + bidder_platform_fee_cents);

comment on column public.winner_invoices.give_holidays_markup_cents is
  'Internal amount retained by Gather from travel-package proceeds; not added to bidder total.';
comment on column public.winner_invoices.give_holidays_wholesale_cost_cents is
  'Internal package cost retained for Give Holidays fulfillment; not added to bidder total.';

