import { Power } from "lucide-react";

// The master switch. Standby outranks the fan card and the temperature
// rule on the board: nothing is actuated, but readings keep arriving.
export function SystemBar({ on, pending, timedOut, onToggle }) {
  const title =
    timedOut ? "No reply from the board"
    : pending ? (on ? "Starting the system…" : "Going to standby…")
    : on ? "System running" : "System on standby";

  const subtitle =
    timedOut ? "The command was saved but the board has not confirmed it"
    : pending ? "Waiting for the board to confirm"
    : on ? "Fan and temperature rule are active"
    : "Nothing is switched on. Readings are still being logged.";

  const cls =
    "system-bar " +
    (timedOut ? "stale" : pending ? "pending" : on ? "on" : "standby");

  return (
    <div className={cls}>
      <div className="icon-container">
        <Power size={17} aria-hidden="true" />
      </div>
      <div className="status-text">
        <span className="title">{title}</span>
        <span className="subtitle">{subtitle}</span>
      </div>
      <button
        className={"toggle-btn " + (on ? "on" : "off")}
        onClick={onToggle}
        disabled={pending}
      >
        {pending ? "Sending…" : on ? "Standby" : "Turn on"}
      </button>
    </div>
  );
}
