import { useState, useEffect, useCallback } from "react";
import { supa, ERROR_TABLE, ERROR_LIMIT } from "../lib/supabase";
import { groupErrors, activeErrors, errorTitle, relativeTime } from "../lib/format";
import { usePreloader } from "../hooks/usePreloader";
import { useTick } from "../hooks/useTick";
import { Ridge, BackLink } from "../components/Ridge";
import { ExportButton } from "../components/ExportButton";
import { IncidentList } from "../components/IncidentList";

const NBSP = " ";

export default function Errors() {
  useTick(30000);                      // keeps "3m ago" honest
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stamp, setStamp] = useState("");

  const load = useCallback(async () => {
    const res = await supa
      .from(ERROR_TABLE)
      .select("id,error_type,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(ERROR_LIMIT);

    setLoading(false);
    if (res.error) {
      setError(/not find the table/i.test(res.error.message)
        ? `Table "${ERROR_TABLE}" not found. Run sql/sensor_errors.sql in the Supabase SQL editor.`
        : res.error.message);
      return;
    }
    setError("");
    setErrors(res.data || []);
    setStamp(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => { load(); }, [load]);
  usePreloader(!loading);

  // new errors arrive over realtime, with a poll as the fallback
  useEffect(() => {
    const ch = supa.channel("errors-page")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: ERROR_TABLE },
        payload => setErrors(prev => (prev.some(e => e.id === payload.new.id)
          ? prev
          : [payload.new, ...prev].slice(0, ERROR_LIMIT))))
      .subscribe();
    const poll = setInterval(load, 30000);
    return () => { supa.removeChannel(ch); clearInterval(poll); };
  }, [load]);

  const groups = groupErrors(errors);
  const active = activeErrors(errors).length;

  // Tally every row by type, not just the collapsed runs.
  const tally = {};
  for (const e of errors) tally[e.error_type] = (tally[e.error_type] || 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="app">
      <Ridge
        title="board errors"
        subtitle="reported by the esp32 · bed 01"
        nav={<BackLink />}
      />

      <div className="summary">
        <div className={"stat " + (active > 0 ? "live" : "clear")}>
          <span className="label">Active now</span>
          <span className="value">{active}</span>
          <span className="sub">{active > 0 ? "needs attention" : "last 10 minutes"}</span>
        </div>
        <div className="stat">
          <span className="label">Incidents</span>
          <span className="value">{groups.length}</span>
          <span className="sub">{errors.length} rows stored</span>
        </div>
        <div className="stat">
          <span className="label">Most common</span>
          <span className="value sm">{top ? errorTitle(top[0]) : "—"}</span>
          <span className="sub">{top ? `${top[1]} of ${errors.length} records` : NBSP}</span>
        </div>
        <div className="stat">
          <span className="label">Last seen</span>
          <span className="value sm">
            {errors.length ? relativeTime(errors[0].created_at) : "—"}
          </span>
          <span className="sub">
            {errors.length ? new Date(errors[0].created_at).toLocaleString() : NBSP}
          </span>
        </div>
      </div>

      <div className="log">
        <div className="log-head">
          <span className="title">
            Incidents<span className="count">({groups.length})</span>
          </span>
          <div className="controls">
            <button className="chip" onClick={load}>Refresh</button>
            <ExportButton />
          </div>
        </div>

        {loading && (
          <div className="state"><span className="spinner" /> Loading error log…</div>
        )}

        {!loading && error && (
          <div className="state">Could not load the error log: {error}</div>
        )}

        {!loading && !error && errors.length === 0 && (
          <div className="state">
            No errors reported by the board. Nothing to see here is the good outcome.
          </div>
        )}

        {!loading && !error && errors.length > 0 && <IncidentList groups={groups} />}
      </div>

      <footer className="footer">
        <span>{stamp ? `refreshed ${stamp}` : NBSP}</span>
        <BackLink />
      </footer>
    </div>
  );
}
