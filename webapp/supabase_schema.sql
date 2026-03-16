-- Run this in your Supabase SQL editor to set up the presets table.

create table if not exists presets (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  description text,
  kp          float not null,
  ki          float not null,
  kd          float not null,
  setpoint    float not null default 5,
  upvotes     int  not null default 0,
  created_at  timestamptz default now()
);

-- Public read access (no auth required)
alter table presets enable row level security;

create policy "Anyone can read presets"
  on presets for select using (true);

create policy "Anyone can insert presets"
  on presets for insert with check (true);

-- Stored procedure for atomic upvote increment
create or replace function increment_upvotes(preset_id uuid)
returns void language sql as $$
  update presets set upvotes = upvotes + 1 where id = preset_id;
$$;

-- Seed some starter presets
insert into presets (name, description, kp, ki, kd, setpoint, upvotes) values
  ('Classic Tuned',   'Well-balanced for 5m step response',       4.0, 0.5, 2.0, 5,  12),
  ('Aggressive Rise', 'Fast to setpoint, handles 10m well',       10,  1.0, 3.5, 10, 7),
  ('Smooth & Slow',   'Minimal overshoot, sluggish but stable',   1.5, 0.2, 1.0, 5,  5),
  ('Ziegler-Nichols', 'Classic Z-N method approximation',         6.0, 1.2, 0.75, 5, 3);
