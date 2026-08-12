// Shows the range the crop wants and marks where the reading falls, so
// "is this right?" needs no arithmetic.
export function Band({ value, cfg, label }) {
  const [lo, hi] = cfg.scale;
  const span = hi - lo;
  const has = Number.isFinite(value);
  const out = has && (value < cfg.target[0] || value > cfg.target[1]);

  // Readings can sit outside the scale, so clamp the marker to the
  // track rather than letting it escape the pane.
  const pct = has ? Math.min(100, Math.max(0, ((value - lo) / span) * 100)) : 0;

  return (
    <div className={"band" + (out ? " out" : "")}>
      <div className="band-track">
        <span
          className="band-zone"
          style={{
            left: ((cfg.target[0] - lo) / span) * 100 + "%",
            width: ((cfg.target[1] - cfg.target[0]) / span) * 100 + "%"
          }}
        />
        <span
          className="band-marker"
          style={{ left: pct + "%", display: has ? "block" : "none" }}
        />
      </div>
      <div className="band-scale">
        <span>{lo}</span>
        <span className="band-target">{label}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
