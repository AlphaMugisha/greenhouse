import { useState, useEffect, useCallback, useRef } from "react";
import {
  supa, TABLE, ERROR_TABLE, HISTORY, ERROR_LIMIT, FALLBACK_MS
} from "../lib/supabase";

// Owns everything that talks to Supabase for the live dashboard.
// Components never fetch and never touch the DOM — they render
// whatever this returns.
export function useSensorFeed() {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [lastDataAt, setLastDataAt] = useState(Date.now());
  const [realtime, setRealtime] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "starting up" });
  const [msg, setMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const pollRef = useRef(null);

  const loadReadings = useCallback(async () => {
    const { data, error } = await supa
      .from(TABLE)
      .select("temperature,humidity,created_at")
      .order("created_at", { ascending: false })
      .limit(HISTORY);

    if (error) {
      setStatus({ kind: "error", text: "db error" });
      setMsg(/not find the table/i.test(error.message)
        ? `Table "${TABLE}" not found. Check Supabase → Data API → Settings.`
        : error.message);
      return;
    }
    if (!data || !data.length) {
      setStatus({ kind: "polling", text: "no data" });
      return;
    }
    setRows(data.slice().reverse());
    setLastDataAt(Date.now());
    setStatus({ kind: "live", text: "live" });
  }, []);

  const loadErrors = useCallback(async () => {
    const { data, error } = await supa
      .from(ERROR_TABLE)
      .select("id,error_type,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(ERROR_LIMIT);
    if (error) { console.warn("Error log unavailable:", error.message); return; }
    setErrors(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      await loadReadings();
      await loadErrors();
      setReady(true);
    })();
  }, [loadReadings, loadErrors]);

  // readings arrive over realtime
  useEffect(() => {
    const ch = supa.channel("greenhouse-readings")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE },
        payload => {
          setRows(prev => {
            const next = [...prev, payload.new];
            return next.length > HISTORY ? next.slice(next.length - HISTORY) : next;
          });
          setLastDataAt(Date.now());
          setStatus({ kind: "live", text: "live" });
        })
      .subscribe(s => { if (s === "SUBSCRIBED") setRealtime(true); });
    return () => { supa.removeChannel(ch); };
  }, []);

  // so do errors, with a poll as the fallback
  useEffect(() => {
    const ch = supa.channel("greenhouse-errors")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: ERROR_TABLE },
        payload => {
          setErrors(prev => prev.some(e => e.id === payload.new.id)
            ? prev
            : [payload.new, ...prev].slice(0, ERROR_LIMIT));
          setMsg(`${payload.new.error_type || "SENSOR ERROR"} — ${payload.new.error_message || "the board reported an error"}`);
        })
      .subscribe();
    const poll = setInterval(loadErrors, 15000);
    return () => { supa.removeChannel(ch); clearInterval(poll); };
  }, [loadErrors]);

  // polling fallback, only if realtime never came up
  useEffect(() => {
    const t = setTimeout(() => {
      if (realtime || pollRef.current) return;
      setStatus({ kind: "polling", text: "polling" });
      pollRef.current = setInterval(loadReadings, FALLBACK_MS);
    }, 4000);
    return () => clearTimeout(t);
  }, [realtime, loadReadings]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadReadings(); await loadErrors(); }
    finally { setRefreshing(false); }
  }, [loadReadings, loadErrors]);

  return { rows, errors, lastDataAt, status, msg, refresh, refreshing, ready };
}
