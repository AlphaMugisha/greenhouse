import { useState, useEffect, useCallback, useRef } from "react";
import { supa, STATE_TABLE, CONFIRM_TIMEOUT } from "../lib/supabase";

// Owns the single device_state row: the fan mode and the master switch.
//
// Both controls work the same way. The browser cannot reach the ESP32,
// so a click only records what was asked for. The board picks it up on
// its next poll and reports back with the following reading. Until that
// report agrees, the command is "pending" — the UI shows intent, and
// never guesses at the hardware.
//
// One hook rather than one per control, so the row is fetched once and
// watched over a single realtime channel.

// Tracks one command until the board's own report agrees with it.
function useConfirm(reported) {
  const [pending, setPending] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef(null);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setPending(null);
    setTimedOut(false);
  }, []);

  const arm = useCallback(value => {
    clearTimeout(timer.current);
    setTimedOut(false);
    setPending(value);
    timer.current = setTimeout(() => setTimedOut(true), CONFIRM_TIMEOUT);
  }, []);

  useEffect(() => {
    if (pending === null || reported === null || reported === undefined) return;
    if (reported === pending) clear();
  }, [reported, pending, clear]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { pending, timedOut, arm, clear };
}

export function useDeviceState(reportedFan, reportedSystem) {
  const [mode, setMode] = useState("auto");
  const [systemOn, setSystemOn] = useState(true);
  const [error, setError] = useState("");
  const fanC = useConfirm(reportedFan);
  const sysC = useConfirm(reportedSystem);

  // whatever the row already says, in case the board or another
  // browser is mid-command
  useEffect(() => {
    let alive = true;
    (async () => {
      // "*" rather than named columns: a dashboard deployed before
      // sql/system_power.sql has run should degrade, not go blank.
      const { data, error } = await supa
        .from(STATE_TABLE)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setError(/not find the table/i.test(error.message)
          ? `Table "${STATE_TABLE}" not found. Run sql/device_state.sql.`
          : error.message);
        return;
      }
      if (!data) return;
      if (data.fan_mode) setMode(data.fan_mode);
      if (typeof data.system_on === "boolean") setSystemOn(data.system_on);
    })();
    return () => { alive = false; };
  }, []);

  // another tab or device may take control; follow it
  useEffect(() => {
    const ch = supa.channel("greenhouse-state")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: STATE_TABLE },
        payload => {
          if (payload.new.fan_mode) setMode(payload.new.fan_mode);
          if (typeof payload.new.system_on === "boolean") setSystemOn(payload.new.system_on);
        })
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, []);

  const write = useCallback(async patch => {
    const { error } = await supa
      .from(STATE_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return error;
  }, []);

  const setFan = useCallback(async next => {
    setError("");
    const prev = mode;
    setMode(next);
    if (next === "auto") fanC.clear();       // nothing specific to confirm
    else fanC.arm(next === "on");

    const err = await write({ fan_mode: next });
    if (err) {                                // never reached the board
      setMode(prev);
      fanC.clear();
      setError(err.message);
    }
  }, [mode, fanC, write]);

  const setPower = useCallback(async next => {
    setError("");
    const prev = systemOn;
    setSystemOn(next);
    sysC.arm(next);

    const err = await write({ system_on: next });
    if (err) {
      setSystemOn(prev);
      sysC.clear();
      setError(/system_on/i.test(err.message)
        ? "Column system_on missing. Run sql/system_power.sql."
        : err.message);
    }
  }, [systemOn, sysC, write]);

  // What each control should show: under a command, what was asked for;
  // otherwise whatever the hardware last reported.
  const fanShown = fanC.pending !== null ? fanC.pending : reportedFan === true;
  const sysShown = sysC.pending !== null ? sysC.pending : systemOn;

  return {
    error,
    fan: {
      mode,
      on: fanShown,
      pending: fanC.pending !== null,
      timedOut: fanC.timedOut,
      unknown: reportedFan === null || reportedFan === undefined,
      standby: !sysShown,
      toggle: () => setFan(fanShown ? "off" : "on"),
      setAuto: () => setFan("auto"),
    },
    system: {
      on: sysShown,
      pending: sysC.pending !== null,
      timedOut: sysC.timedOut,
      toggle: () => setPower(!sysShown),
    },
  };
}
