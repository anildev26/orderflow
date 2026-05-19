-- Demo orders table for the public demo dashboard.
-- Completely separate from the real 'orders' table — no user_id, no mixing.
-- Admin (is_platform_admin) can CRUD. Public can read visible rows.

create table if not exists public.demo_orders (
  id                      uuid primary key default gen_random_uuid(),
  platform                text        not null,
  order_id                text        not null,
  brand_name              text        not null default '',
  product_name            text        not null default '',
  order_date              date        not null,
  total_amount            numeric     not null default 0,
  seller_less             numeric     not null default 0,
  mediator_name           text        not null default '',
  reviewer_name           text        not null default '',
  order_type              text        not null default 'Review',
  is_replacement          boolean     not null default false,
  is_exchange             boolean     not null default false,
  exchange_product_name   text        not null default '',
  replacement_order_id    text        not null default '',
  mediator_message        text        not null default '',
  refund_form_link        text        not null default '',
  status                  text        not null default 'ordered',
  delivered_date          date,
  return_period_days      int         not null default 7,
  review_rating_date      date,
  refund_form_filled_date date,
  informed_mediator_date  date,
  payment_received_date   date,
  payment_bank            text        not null default '',
  is_visible              boolean     not null default true,   -- controls public visibility
  sort_order              int         not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- RLS
alter table public.demo_orders enable row level security;

-- Public read — no auth required, only visible rows
create policy "demo_orders_public_read"
  on public.demo_orders
  for select
  using (is_visible = true);

-- Admin read all (including hidden rows, for management UI)
create policy "demo_orders_admin_read_all"
  on public.demo_orders
  for select
  using (is_platform_admin());

-- Admin write
create policy "demo_orders_admin_insert"
  on public.demo_orders
  for insert
  with check (is_platform_admin());

create policy "demo_orders_admin_update"
  on public.demo_orders
  for update
  using (is_platform_admin());

create policy "demo_orders_admin_delete"
  on public.demo_orders
  for delete
  using (is_platform_admin());

-- Auto-update updated_at
create or replace function public.set_demo_orders_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger demo_orders_updated_at
  before update on public.demo_orders
  for each row execute function public.set_demo_orders_updated_at();

-- Seed: 4 sample demo orders across different platforms
insert into public.demo_orders
  (platform, order_id, brand_name, product_name, order_date, total_amount, seller_less,
   mediator_name, reviewer_name, order_type, status, mediator_message, sort_order, is_visible)
values
  ('flipkart', 'FK-DEMO-001', 'Noise', 'Noise Buds N1 Earphones',
   current_date - 25, 899, 100, 'Yash', 'Aaditya', 'Review',
   'review_rating_submitted',
   'Please submit your review on the product page and share the screenshot.',
   1, true),

  ('amazon', 'AMZ-DEMO-002', 'boAt', 'boAt Bassheads 100 Wired Earphones',
   current_date - 10, 299, 50, 'Saloni', 'Anil Sahu', 'Rating',
   'delivered',
   'Rate the product 5 stars after delivery. Send screenshot to confirm.',
   2, true),

  ('meesho', 'MSH-DEMO-003', 'Generic', 'Cotton Bedsheet Set (King Size)',
   current_date - 45, 499, 80, 'Mood Off', 'Anil Sahu Meesho', 'Review',
   'refund_form_filled',
   'Refund form link: https://forms.gle/demo-refund-link. Fill and submit.',
   3, true),

  ('myntra', 'MYN-DEMO-004', 'H&M', 'Men''s Slim Fit Chinos',
   current_date - 60, 1299, 200, 'Farooq', 'Aaditya', 'Review',
   'payment_received',
   'Payment done. Archive this order.',
   4, false);
