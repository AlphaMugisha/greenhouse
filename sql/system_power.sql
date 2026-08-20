-- Master switch for the whole rig.
--
-- Adds the standby control to the existing downlink table, and a
-- matching column on sensor_data so the board can report back which
-- state it is actually in. The dashboard only believes the switch once
-- that report agrees, exactly as it does for the fan.
--
-- Safe to run more than once. Run sql/device_state.sql first.

-- What the dashboard asks for
alter table public.device_state
  add column if not exists system_on boolean not null default true;

-- What the board reports it is doing
alter table public.sensor_data
  add column if not exists system_on boolean;

-- Existing rows predate the column and cannot be known retroactively,
-- so they stay null rather than claiming a state that was never sent.
