// Two kinds of card share this shell.
//
// A commanded device (the fan) is wired to real hardware: `on` is what
// the board last reported, and while a command is in flight `pending`
// says so rather than pretending the relay already moved. A plain card
// (the air inlet, which has no relay yet) passes none of that and keeps
// the old local-state behaviour.
export function DeviceCard({
  id, icon: Icon, name, on, onToggle, spins,
  mode, pending = false, timedOut = false, unknown = false, onAuto,
  standby = false,
}) {
  const commanded = typeof mode === "string";
  // Standby outranks this card on the board, so offering a switch here
  // would promise something the hardware will refuse.
  const locked = pending || standby;

  const badge =
    standby ? "STANDBY"
    : timedOut ? "NO REPLY"
    : pending ? (on ? "STARTING" : "STOPPING")
    : commanded && unknown ? "--"
    : on ? "ON" : "OFF";

  const badgeColor =
    standby ? "var(--stem)"
    : timedOut ? "var(--rust)"
    : pending ? "var(--stem)"
    : on ? "var(--frond)" : "var(--stem)";

  const label =
    standby ? "System is on standby"
    : timedOut ? "No reply from the board"
    : pending ? "Waiting for the board"
    : commanded && unknown ? "Waiting for the first reading"
    : on ? "On" : "Off";

  return (
    <section className="pane card device-card" id={id}>
      <div className="card-label">
        <span className="device-name">
          <span className={"device-icon" + (spins && on && !locked ? " spin" : "")}>
            <Icon size={15} aria-hidden="true" />
          </span>
          {name}
        </span>
        <span className="delta-badge" style={{ color: badgeColor }}>
          {badge}
        </span>
      </div>

      {commanded && (
        <div className={"device-mode" + (mode !== "auto" && !standby ? " manual" : "")}>
          {standby
            ? "Suspended by the master switch"
            : mode === "auto"
              ? "Automatic — temperature decides"
              : `Manual — held ${mode}`}
          {mode !== "auto" && !standby && (
            <button className="link-btn" onClick={onAuto}>
              Back to automatic
            </button>
          )}
        </div>
      )}

      <div className="device-status">
        <div className="indicator">
          <span className={"dot " + (pending ? "pending" : on && !standby ? "on" : "off")} />
          <span>{label}</span>
        </div>
        <button
          className={"toggle-btn " + (on && !standby ? "on" : "off") + (locked ? " busy" : "")}
          onClick={onToggle}
          disabled={locked}
          title={standby ? "Turn the system on first" : undefined}
        >
          {pending ? "Sending…" : on && !standby ? "Turn off" : "Turn on"}
        </button>
      </div>
    </section>
  );
}
