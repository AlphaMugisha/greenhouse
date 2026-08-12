import { ERROR_ACTIVE_MS } from "./supabase";

export const errorAge = ts => Date.now() - new Date(ts).getTime();

export function relativeTime(ts) {
  const diff = errorAge(ts);
  if (diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

export const LCD_WIDTH = 16;

// The real screen was 16 characters wide and the firmware cut anything
// longer, so the same limit applies here.
export const lcdPad = s => String(s).slice(0, LCD_WIDTH).padEnd(LCD_WIDTH, " ");

export const fmt = (v, digits = 1) =>
  Number.isFinite(v) ? v.toFixed(digits) : "—";

// Hardware sanity, not crop comfort: is the sensor worth believing?
export const implausible = (t, h) => ({
  t: (t < -5 || t > 55) ? "Sensor out of range" : "",
  h: (h < 10 || h > 100) ? "Sensor out of range" : ""
});

export function deriveMetrics(t, h) {
  const dew = t - ((100 - h) / 5);
  const vpd = (100 - h) * 0.012;
  return { dew: Math.round(dew * 10) / 10, vpd: Math.round(vpd * 100) / 100 };
}

// There is no CO2 sensor on the board; this is a stand-in derived from
// the two real readings, and the card says so.
export const co2From = (t, h, jitter = true) =>
  Math.round(380 + (t * 3.5) + (h * 0.8) + (jitter ? Math.sin(Date.now() / 60000) * 20 : 0));

// The ranges the crop actually wants, which the bands draw and the
// notes read from, so the two can never disagree.
export const BANDS = {
  temp: { scale: [0, 50],  target: [18, 28] },
  hum:  { scale: [0, 100], target: [50, 70] }
};

export function climateNote(v, cfg, sensorFault) {
  if (sensorFault) return { text: "Sensor out of range", cls: " warning" };
  if (!Number.isFinite(v)) return { text: "No reading yet", cls: "" };
  if (v < cfg.target[0]) return { text: "Below target range", cls: " flag" };
  if (v > cfg.target[1]) return { text: "Above target range", cls: " flag" };
  return { text: "In range", cls: "" };
}

const ERROR_TITLES = {
  DHT11_READ_ERROR:      "Sensor read failed",
  DHT11_RANGE_ERROR:     "Reading out of range",
  WIFI_CONNECTION_ERROR: "Wi-Fi dropped",
  SUPABASE_UPLOAD_ERROR: "Upload failed",
  REALTIME_SELFTEST:     "Realtime self-test"
};

// Known faults get a plain-language name. Anything unmapped falls back
// to a tidied version of the raw type, so a new error the firmware
// starts sending is never silently unlabelled.
export const errorTitle = type => ERROR_TITLES[type] ||
  String(type || "Unknown error").toLowerCase().replace(/_/g, " ")
    .replace(/^./, c => c.toUpperCase());

// A stuck sensor writes the same row every few seconds. Collapsing a run
// into one entry with a tally turns a wall of repeats into a readable
// list of incidents.
//
// Runs are keyed on type alone, not on the message: some messages carry
// the reading that failed, so keying on both would leave every one of
// them ungrouped. The newest message stands for the run.
export function groupErrors(list) {
  const groups = [];
  for (const row of list) {
    const last = groups[groups.length - 1];
    if (last && last.type === row.error_type) {
      last.count++;
      last.oldest = row.created_at;   // list is newest first
    } else {
      groups.push({
        type: row.error_type,
        message: row.error_message,
        count: 1,
        newest: row.created_at,
        oldest: row.created_at
      });
    }
  }
  return groups;
}

export function errorStreak(errors, type) {
  let n = 0;
  for (const e of errors) {
    if (e.error_type !== type) break;
    n++;
  }
  return n;
}

export const activeErrors = errors =>
  errors.filter(e => errorAge(e.created_at) <= ERROR_ACTIVE_MS);

// Reproduces the two lines the firmware wrote to its 16x2 LCD, with the
// same wording and the same precedence: an active fault wins, then link
// state, then the reading.
export function deviceScreenLines(rows, errors, offline) {
  const active = errors.find(e => errorAge(e.created_at) <= ERROR_ACTIVE_MS);
  if (active) {
    switch (active.error_type) {
      case "DHT11_READ_ERROR":
        return ["DHT11 READ ERROR", "Check sensor " + errorStreak(errors, "DHT11_READ_ERROR"), true];
      case "WIFI_CONNECTION_ERROR":
        return ["WIFI LOST", "Reconnecting...", true];
      case "SUPABASE_UPLOAD_ERROR":
        return ["UPLOAD FAILED", "Data not saved", true];
      default:
        return [active.error_type || "DEVICE ERROR", active.error_message || "", true];
    }
  }
  if (!rows.length) return ["GREENHOUSE", "Starting up...", false];
  if (offline) return ["WIFI LOST", "Reconnecting...", true];
  const latest = rows[rows.length - 1];
  return [
    "Temp: " + Number(latest.temperature).toFixed(1) + " C",
    "Hum:  " + Number(latest.humidity).toFixed(1) + " %",
    false
  ];
}
