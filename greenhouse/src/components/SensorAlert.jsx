import { Link } from "react-router-dom";
import { TriangleAlert, Unplug, ArrowRight } from "lucide-react";
import { relativeTime, errorTitle, faultRepeats } from "../lib/format";

const pad = n => String(n).padStart(2, "0");

function since(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${pad(seconds % 60)}s`;
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

// The loud one. Shown only when something is actually wrong, so that it
// still means something when it does appear.
//
// Two different failures, deliberately worded differently:
//   fault    the board is reachable and reporting, but the sensor on the
//            end of it is not answering — the detail comes from the row
//            the board wrote into sensor_errors
//   offline  nothing has arrived at all. We know the readings stopped;
//            we do not know why, so we do not guess at a cause.
export function SensorAlert({ offline, fault, errors, secondsSinceData }) {
  if (!offline && !fault) return null;

  const isFault = Boolean(fault);
  const Icon = isFault ? TriangleAlert : Unplug;
  const repeats = isFault ? faultRepeats(errors, fault.error_type) : 0;

  return (
    <section
      className={"sensor-alert " + (isFault ? "fault" : "offline")}
      role="alert"
      aria-live="assertive"
    >
      <div className="sa-glow" aria-hidden="true" />

      <div className="sa-icon">
        <Icon size={30} strokeWidth={1.75} aria-hidden="true" />
      </div>

      <div className="sa-body">
        <h2 className="sa-title">
          {isFault ? "Sensor not responding" : "Sensor connection lost"}
        </h2>

        <p className="sa-lede">
          {isFault
            ? "The board is online and reporting, but the sensor is not returning readings."
            : `No reading has arrived for ${since(secondsSinceData)}. The readings below are the last ones received.`}
        </p>

        {isFault && (
          <div className="sa-detail">
            <span className="sa-code">{fault.error_type}</span>
            {repeats > 1 && <span className="sa-repeats">{repeats}× in a row</span>}
            <span className="sa-ago">{relativeTime(fault.created_at)}</span>
          </div>
        )}

        {isFault && (
          <p className="sa-message">
            {fault.error_message || errorTitle(fault.error_type)}
          </p>
        )}

        <Link className="sa-action" to="/errors">
          {isFault ? "See the full error log" : "Check the error log"}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="sa-meta">
        <span className="sa-meta-label">Last reading</span>
        <span className="sa-meta-value">{since(secondsSinceData)} ago</span>
      </div>
    </section>
  );
}
