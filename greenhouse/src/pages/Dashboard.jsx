import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Fan, Wind, RefreshCw } from "lucide-react";
import { useTick } from "../hooks/useTick";
import { usePreloader } from "../hooks/usePreloader";
import { useSensorFeed } from "../hooks/useSensorFeed";
import { useDeviceState } from "../hooks/useDeviceState";
import { CONNECTION_TIMEOUT } from "../lib/supabase";
import {
  BANDS, climateNote, implausible, deriveMetrics, co2From,
  activeErrors, activeSensorFault, groupErrors
} from "../lib/format";
import { Ridge } from "../components/Ridge";
import { ConnectionBar } from "../components/ConnectionBar";
import { SensorAlert } from "../components/SensorAlert";
import { AlertBanner } from "../components/AlertBanner";
import { ClimatePane } from "../components/ClimatePane";
import { DeviceCard } from "../components/DeviceCard";
import { SystemBar } from "../components/SystemBar";
import { ExportButton } from "../components/ExportButton";
import { BoardScreen } from "../components/BoardScreen";
import { Delta } from "../components/Delta";
import { Trace } from "../components/Trace";

export default function Dashboard() {
  useTick(1000);                       // one clock drives every elapsed value
  const { rows, errors, lastDataAt, status, msg, refresh, refreshing, ready } = useSensorFeed();
  const [dismissed, setDismissed] = useState(null);
  const [devices, setDevices] = useState({ vent: false });   // the inlet has no relay yet
  const startRef = useRef(Date.now());

  usePreloader(ready);

  // Derived, not stored, so it can never go stale.
  const offline = rows.length > 0 && Date.now() - lastDataAt > CONNECTION_TIMEOUT;
  const sinceData = Math.floor((Date.now() - lastDataAt) / 1000);
  const up = Math.floor((Date.now() - startRef.current) / 1000);
  const uptime = `${String(Math.floor(up / 60)).padStart(2, "0")}:${String(up % 60).padStart(2, "0")}`;

  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  // The fan and the master switch are backed by real hardware, so they
  // are driven by what the board reports rather than by local state.
  const { fan, system, error: cmdError } =
    useDeviceState(
      latest ? latest.fan_status : null,
      latest ? latest.system_on : null
    );
  const t = latest ? Number(latest.temperature) : NaN;
  const h = latest ? Number(latest.humidity) : NaN;
  const co2 = latest ? co2From(t, h) : NaN;
  const flags = implausible(t, h);
  const { dew, vpd } = latest ? deriveMetrics(t, h) : { dew: null, vpd: null };

  const now = new Date();
  const timeString = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const secondsString = String(now.getSeconds()).padStart(2, "0");

  const tempValues = useMemo(() => rows.map(r => Number(r.temperature)), [rows]);
  const humValues = useMemo(() => rows.map(r => Number(r.humidity)), [rows]);
  const co2Values = useMemo(
    () => rows.map(r => co2From(Number(r.temperature), Number(r.humidity), false)),
    [rows]
  );

  const active = activeErrors(errors).length;
  const fault = activeSensorFault(errors);
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
            <ExportButton variant="nav" />
          </>
        }
      />

      {offline || fault
        ? <SensorAlert
            offline={offline}
            fault={fault}
            errors={errors}
            secondsSinceData={sinceData}
          />
        : <ConnectionBar offline={false} seconds={sinceData} />}

      {/* the small banner only carries faults the big one is not already
          showing, so nothing is said twice */}
      {!fault && (
        <AlertBanner errors={errors} dismissed={dismissed} onDismiss={setDismissed} />
      )}

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
            Current time
          </div>
          <div className="value-block">
            <div className="value-number">
              <span className="num" key={timeString}>
                {timeString}
              </span>
              <span className="unit">{secondsString}</span>
            </div>
          </div>
          <div className="card-note">
            System clock updated in real-time
          </div>
        </section>
      </div>

      <SystemBar
        on={system.on}
        pending={system.pending}
        timedOut={system.timedOut}
        onToggle={system.toggle}
      />

      <div className="panes rig">
        <DeviceCard id="card-fan" icon={Fan} name="Fan" spins
          on={fan.on} onToggle={fan.toggle}
          mode={fan.mode} pending={fan.pending} timedOut={fan.timedOut}
          unknown={fan.unknown} onAuto={fan.setAuto} standby={fan.standby} />
        <DeviceCard id="card-vent" icon={Wind} name="Air inlet"
          on={devices.vent} onToggle={() => toggle("vent")} />
        <BoardScreen rows={rows} errors={errors} offline={offline} />
      </div>

      {(cmdError || msg) && <div className="msg">{cmdError || msg}</div>}

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
