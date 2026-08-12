// Local UI state only: the board does not yet accept commands, so this
// reflects what you asked for rather than what the hardware is doing.
export function DeviceCard({ id, icon: Icon, name, on, onToggle, spins }) {
  return (
    <section className="pane card device-card" id={id}>
      <div className="card-label">
        <span className="device-name">
          <span className={"device-icon" + (spins && on ? " spin" : "")}>
            <Icon size={15} aria-hidden="true" />
          </span>
          {name}
        </span>
        <span className="delta-badge" style={{ color: on ? "var(--frond)" : "var(--stem)" }}>
          {on ? "ON" : "OFF"}
        </span>
      </div>
      <div className="device-status">
        <div className="indicator">
          <span className={"dot " + (on ? "on" : "off")} />
          <span>{on ? "On" : "Off"}</span>
        </div>
        <button className={"toggle-btn " + (on ? "on" : "off")} onClick={onToggle}>
          {on ? "Turn off" : "Turn on"}
        </button>
      </div>
    </section>
  );
}
