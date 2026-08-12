import { deviceScreenLines, lcdPad } from "../lib/format";

// The same two lines the firmware wrote to its 16x2 LCD.
export function BoardScreen({ rows, errors, offline }) {
  const [top, bottom, isError] = deviceScreenLines(rows, errors, offline);
  return (
    <section className="pane screen-pane">
      <div className="screen-meta">
        <span className="screen-title">Board screen</span>
        <span className="screen-sub">16 × 2</span>
      </div>
      <div className={"lcd" + (isError ? " error" : "")}>
        <div className="lcd-line">{lcdPad(top)}</div>
        <div className="lcd-line">{lcdPad(bottom)}</div>
      </div>
    </section>
  );
}
