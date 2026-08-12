create table if not exists public.sensor_errors (
  id bigint generated always as identity primary key,
  error_type text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists sensor_errors_created_at_idx
  on public.sensor_errors (created_at desc);

alter table public.sensor_errors enable row level security;

drop policy if exists "device can log errors" on public.sensor_errors;
create policy "device can log errors"
  on public.sensor_errors
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "dashboard can read errors" on public.sensor_errors;
create policy "dashboard can read errors"
  on public.sensor_errors
  for select
  to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.sensor_errors;
exception
  when duplicate_object then null;
end $$;
