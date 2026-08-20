-- Downlink channel: the dashboard writes here, the ESP32 polls it.
--
-- The board cannot be reached from the browser (private IP, no inbound
-- route), so a command travels dashboard -> this row -> ESP32 poll.
-- One row, id = 1, always present.

create table if not exists public.device_state (
  id         smallint primary key default 1,
  fan_mode   text        not null default 'auto',
  updated_at timestamptz not null default now(),

  -- one row only: no second device can be inserted by mistake
  constraint device_state_single_row check (id = 1),

  -- 'auto' hands control back to the temperature rule on the board
  constraint device_state_fan_mode_valid check (fan_mode in ('auto', 'on', 'off'))
);

insert into public.device_state (id, fan_mode)
values (1, 'auto')
on conflict (id) do nothing;

alter table public.device_state enable row level security;

drop policy if exists "device can read state" on public.device_state;
create policy "device can read state"
  on public.device_state
  for select
  to anon, authenticated
  using (true);

-- NOTE: this grants anyone holding the publishable key the ability to
-- switch the fan. That is acceptable for a lab build on a private
-- network; put this behind an authenticated role before it controls
-- anything that matters. There is deliberately no insert or delete
-- policy, so the single row cannot be removed or duplicated.
drop policy if exists "dashboard can set state" on public.device_state;
create policy "dashboard can set state"
  on public.device_state
  for update
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.device_state;
exception
  when duplicate_object then null;
end $$;
