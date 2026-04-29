-- ─── Run this in Supabase SQL Editor ─────────────────────────────────────────

-- 1. Business KYC
create table if not exists business_kyc (
  id                  uuid primary key default gen_random_uuid(),
  wallet_address      text unique not null,
  business_name       text not null,
  business_type       text not null,
  registration_number text not null,
  business_address    text not null,
  country             text not null,
  document_url        text,
  status              text default 'pending' check (status in ('pending','under_review','approved','rejected')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- 2. Merchant QR Codes
create table if not exists merchant_qr_codes (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  token          text not null,
  amount         text,
  reference      text,
  qr_string      text not null,
  created_at     timestamptz default now()
);

-- 3. P2P Orders
create table if not exists p2p_orders (
  id               uuid primary key default gen_random_uuid(),
  seller_wallet    text not null,
  buyer_wallet     text,
  token            text not null,
  amount           numeric not null,
  fiat_currency    text not null,
  rate             numeric not null,
  fiat_total       numeric not null,
  payment_method   text not null,
  country          text not null,
  status           text default 'open' check (status in ('open','in_escrow','fiat_sent','completed','cancelled','disputed')),
  is_merchant      boolean default false,
  network          text default 'Sepolia',
  deposit_tx_hash  text,
  release_tx_hash  text,
  created_at       timestamptz default now()
);

-- Add columns to existing table (run if table already exists)
alter table p2p_orders add column if not exists network         text default 'Sepolia';
alter table p2p_orders add column if not exists deposit_tx_hash text;
alter table p2p_orders add column if not exists release_tx_hash text;

-- 4. Escrow Locks
create table if not exists escrow_locks (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references p2p_orders(id),
  seller_wallet  text not null,
  buyer_wallet   text,
  token          text not null,
  amount         numeric not null,
  status         text default 'locked' check (status in ('locked','released','refunded')),
  created_at     timestamptz default now()
);

-- Enable RLS (Row Level Security) — allow anon for demo
alter table business_kyc      enable row level security;
alter table merchant_qr_codes enable row level security;
alter table p2p_orders        enable row level security;
alter table escrow_locks      enable row level security;

create policy "allow all" on business_kyc      for all using (true) with check (true);
create policy "allow all" on merchant_qr_codes for all using (true) with check (true);
create policy "allow all" on p2p_orders        for all using (true) with check (true);
create policy "allow all" on escrow_locks      for all using (true) with check (true);
