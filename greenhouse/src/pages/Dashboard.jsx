import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Fan, Wind, RefreshCw } from "lucide-react";
import { useTick } from "../hooks/useTick";
import { usePreloader } from "../hooks/usePreloader";
import { useSensorFeed } from "../hooks/useSensorFeed";
import { CONNECTION_TIMEOUT } from "../lib/supabase";
import {
  BANDS, climateNote, implausible, deriveMetrics, co2From,
  activeErrors, groupErrors
} from "../lib/format";
import { Ridge } from "../components/Ridge";
import { ConnectionBar } from "../components/ConnectionBar";
import { AlertBanner } from "../components/AlertBanner";
import { ClimatePane } from "../components/ClimatePane";
import { DeviceCard } from "../components/DeviceCard";
import { BoardScreen } from "../components/BoardScreen";
import { Delta } from "../components/Delta";
import { Trace } from "../components/Trace";

export default function Dashboard() {
  useTick(1000);                       // one clock drives every elapsed value
  const { rows, errors, lastDataAt, status, msg, refresh, refreshing, ready } = useSensorFeed();
  const [dismissed, setDismissed] = useState(null);
  const [devices, setDevices] = useState({ fan: false, vent: false });
  const startRef = useRef(Date.now());

  usePreloader(ready);

  // Derived, not stored, so it can never go stale.
  const offline = rows.length > 0 && Date.now() - lastDataAt > CONNECTION_TIMEOUT;
  const sinceData = Math.floor((Date.now() - lastDataAt) / 1000);
  const up = Math.floor((Date.now() - startRef.current) / 1000);
  const uptime = `${String(Math.floor(up / 60)).padStart(2, "0")}:${String(up % 60).padStart(2, "0")}`;

  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const t = latest ? Number(latest.temperature) : NaN;
  const h = latest ? Number(latest.humidity) : NaN;
  const co2 = latest ? co2From(t, h) : NaN;
  const flags = implausible(t, h);
  const { dew, vpd } = latest ? deriveMetrics(t, h) : { dew: null, vpd: null };

  const tempValues = useMemo(() => rows.map(r => Number(r.temperature)), [rows]);
  const humValues = useMemo(() => rows.map(r => Number(r.humidity)), [rows]);
  const co2Values = useMemo(
    () => rows.map(r => co2From(Number(r.temperature), Number(r.humidity), false)),
    [rows]
  );

  const active = activeErrors(errors).length;
  const incidents = groupErrors(errors).length;
  const toggle = key => setDevices(d => ({ ...d, [key]: !d[key] }));

  return (
    <div className="app">
      <Ridge
        title="glasshouse"
        subtitle="live climate · bed 01"
        status={status}
        uptime={uptime}
        readouts={[
          { label: "Dew point", value: dew === null ? "--°C" : dew.toFixed(1) + "°C" },
          { label: "VPD", value: vpd === null ? "-- kPa" : vpd.toFixed(2) + " kPa" },
          { label: "Readings", value: rows.length }
        ]}
        nav={
          <>
            <Link className="nav-btn" to="/history">
              History <span className="tag">{rows.length}</span>
            </Link>
            <Link className={"nav-btn" + (active > 0 ? " alert" : "")} to="/errors">
              Errors <span className="tag">{active > 0 ? `${active} active` : incidents}</span>
            </Link>
          </>
        }
      />

      <ConnectionBar offline={offline} seconds={sinceData} />

      <AlertBanner errors={errors} dismissed={dismissed} onDismiss={setDismissed} />

      <div className="panes climate">
        <ClimatePane
          id="card-temp" label="Air temperature" unit="°C"
          value={t} prev={prev ? Number(prev.temperature) : undefined}
          note={climateNote(t, BANDS.temp, !!flags.t)}
          cfg={BANDS.temp} bandLabel="grows best 18–28 °C"
          traceId="traceTemp" values={tempValues}
          stamp={latest && latest.created_at}
        />

        <ClimatePane
          id="card-hum" label="Relative humidity" unit="%"
          value={h} prev={prev ? Number(prev.humidity) : undefined}
          note={climateNote(h, BANDS.hum, !!flags.h)}
          cfg={BANDS.hum} bandLabel="grows best 50–70 %"
          traceId="traceHum" values={humValues}
          stamp={latest && latest.created_at}
        />

        <section className="pane card grid-full" id="card-co2">
          <div className="card-label">
            Carbon dioxide
            <Delta
              curr={co2}
              prev={prev ? co2From(Number(prev.temperature), Number(prev.humidity), false) : undefined}
              digits={0}
            />
          </div>
          <div className="value-block">
            <div className="value-number">
              <span className="num" key={latest && latest.created_at}>
                {Number.isFinite(co2) ? co2 : "--"}
              </span>
              <span className="unit">ppm</span>
            </div>
          </div>
          <div className={"card-note" + (co2 > 800 ? " flag" : "")}>
            {co2 > 800
              ? "Elevated CO₂"
              : "Estimated from temperature and humidity, not measured"}
          </div>
          <Trace id="traceCo2" values={co2Values} />
        </section>
      </div>

      <div className="panes rig">
        <DeviceCard id="card-fan" icon={Fan} name="Fan" spins
          on={devices.fan} onToggle={() => toggle("fan")} />
        <DeviceCard id="card-vent" icon={Wind} name="Air inlet"
          on={devices.vent} onToggle={() => toggle("vent")} />
        <BoardScreen rows={rows} errors={errors} offline={offline} />
      </div>

      {msg && <div className="msg">{msg}</div>}

      <footer className="footer">
        <span>
          <span className={"live-icon" + (offline ? " disconnected" : "")} />
          {latest
            ? `last reading ${new Date(latest.created_at).toLocaleTimeString()} · ${rows.length} stored`
            : "Waiting for the first reading"}
        </span>
        <button className={"btn" + (refreshing ? " refreshing" : "")} onClick={refresh}>
          <span className="refresh-spinner" />
          <span className="btn-text">
            <RefreshCw size={13} aria-hidden="true" /> Refresh
          </span>
        </button>
      </footer>
    </div>
  );
}
