import { Delta } from "./Delta";
import { Band } from "./Band";
import { Trace } from "./Trace";

export function ClimatePane({
  id, label, unit, value, prev, note, cfg, bandLabel, traceId, values, stamp
}) {
  return (
    <section className="pane card" id={id}>
      <div className="card-label">
        {label}
        <Delta curr={value} prev={prev} />
      </div>
      <div className="value-block">
        <div className="value-number">
          {/* keyed on the reading, so a new value replays its animation */}
          <span className="num" key={stamp}>
            {Number.isFinite(value) ? value.toFixed(1) : "--"}
          </span>
          <span className="unit">{unit}</span>
        </div>
      </div>
      <div className={"card-note" + note.cls}>{note.text}</div>
      <Band value={value} cfg={cfg} label={bandLabel} />
      <Trace id={traceId} values={values} />
    </section>
  );
}
