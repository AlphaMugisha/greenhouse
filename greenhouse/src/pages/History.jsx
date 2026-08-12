import { useState, useEffect, useCallback } from "react";
import { supa, TABLE } from "../lib/supabase";
import { fmt } from "../lib/format";
import { usePreloader } from "../hooks/usePreloader";
import { Ridge, BackLink } from "../components/Ridge";

const LIMITS = [100, 500, 2000];
const NBSP = " ";

export default function History() {
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stamp, setStamp] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Temperature and humidity only. CO2 on the dashboard is derived
    // from these two, so logging it would just repeat them.
    const res = await supa
      .from(TABLE)
      .select("temperature,humidity,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    setLoading(false);
    if (res.error) {
      setError(/not find the table/i.test(res.error.message)
        ? `Table "${TABLE}" not found. Check Supabase, Data API, Settings.`
        : res.error.message);
      return;
    }
    setError("");
    setRows(res.data || []);
    setStamp(new Date().toLocaleTimeString());
  }, [limit]);

  useEffect(() => { load(); }, [load]);
  usePreloader(!loading);

  const temps = rows.map(r => Number(r.temperature)).filter(Number.isFinite);
  const hums = rows.map(r => Number(r.humidity)).filter(Number.isFinite);
  const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const newest = rows.length ? new Date(rows[0].created_at) : null;
  const oldest = rows.length ? new Date(rows[rows.length - 1].created_at) : null;

  let prevDay = "";

  return (
    <div className="app">
      <Ridge
        title="reading history"
        subtitle="temperature and humidity · bed 01"
        nav={<BackLink />}
      />

      <div className="summary">
        <div className="stat">
          <span className="label">Readings</span>
          <span className="value">{rows.length}</span>
          <span className="sub">
            {oldest ? `${oldest.toLocaleDateString()} – ${newest.toLocaleDateString()}` : NBSP}
          </span>
        </div>
        <div className="stat temp">
          <span className="label">Temperature</span>
          <span className="value">{fmt(avg(temps))} °C</span>
          <span className="sub">
            {temps.length ? `low ${fmt(Math.min(...temps))} · high ${fmt(Math.max(...temps))}` : NBSP}
          </span>
        </div>
        <div className="stat hum">
          <span className="label">Humidity</span>
          <span className="value">{fmt(avg(hums))} %</span>
          <span className="sub">
            {hums.length ? `low ${fmt(Math.min(...hums))} · high ${fmt(Math.max(...hums))}` : NBSP}
          </span>
        </div>
        <div className="stat">
          <span className="label">Latest</span>
          <span className="value sm">
            {rows.length
              ? `${fmt(Number(rows[0].temperature))}° / ${fmt(Number(rows[0].humidity))}%`
              : "—"}
          </span>
          <span className="sub">{newest ? newest.toLocaleString() : NBSP}</span>
        </div>
      </div>

      <div className="log">
        <div className="log-head">
          <span className="title">
            Log<span className="count">({rows.length})</span>
          </span>
          <div className="controls">
            {LIMITS.map(n => (
              <button
                key={n}
                className={"chip" + (limit === n ? " on" : "")}
                onClick={() => setLimit(n)}
              >
                {n}
              </button>
            ))}
            <button className="chip" onClick={load}>Refresh</button>
          </div>
        </div>

        {loading && (
          <div className="state"><span className="spinner" /> Loading readings…</div>
        )}

        {!loading && error && (
          <div className="state">Could not load readings: {error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="state">
            No readings stored yet. They appear here as soon as the board sends one.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th className="num">Temperature °C</th>
                  <th className="num">Humidity %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const time = new Date(row.created_at);
                  const day = time.toLocaleDateString();
                  const newDay = day !== prevDay;
                  prevDay = day;
                  // The date only earns a place when it changes.
                  const label = newDay
                    ? `${day} ${time.toLocaleTimeString()}`
                    : time.toLocaleTimeString();
                  return (
                    <tr key={row.created_at + i} className={newDay ? "daybreak" : undefined}>
                      <td className="time">{label}</td>
                      <td className="temp num">{fmt(Number(row.temperature))}</td>
                      <td className="hum num">{fmt(Number(row.humidity))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="footer">
        <span>{rows.length} readings shown{stamp ? ` · refreshed ${stamp}` : ""}</span>
        <BackLink />
      </footer>
    </div>
  );
}
