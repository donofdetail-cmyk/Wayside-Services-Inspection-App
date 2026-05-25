-- Run this SQL in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → paste & run

create table if not exists d2d_leads (
  id uuid primary key default gen_random_uuid(),
  rep_name text not null,
  address text,
  lat float,
  lng float,
  sqft text,
  tier text,
  status text not null,
  contact_name text,
  phone text,
  notes text,
  follow_up_date text,
  created_at timestamptz default now()
);

-- Optional: enable Row Level Security (RLS)
alter table d2d_leads enable row level security;

-- Allow all inserts/reads with the anon key (open policy for internal use)
create policy "Allow anon read" on d2d_leads for select using (true);
create policy "Allow anon insert" on d2d_leads for insert with check (true);
create policy "Allow anon update" on d2d_leads for update using (true);
