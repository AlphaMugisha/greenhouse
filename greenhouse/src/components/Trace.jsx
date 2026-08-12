import { useMemo } from "react";

// A sparkline drawn straight from the readings. Memoised so it is only
// recomputed when the values actually change, not on every clock tick.
export function Trace({ id, values }) {
  const paths = useMemo(() => {
    if (values.length < 2) return null;
    const W = 300, H = 72, pad = 6;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = (max - min) || 1;
    const step = W / (values.length - 1);
    const pts = values.map((v, i) => [i * step, H - pad - ((v - min) / span) * (H - pad * 2)]);
    const d = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
    return { line: d, fill: `${d} L ${W} ${H} L 0 ${H} Z` };
  }, [values]);

  return (
    <svg className="trace" id={id} preserveAspectRatio="none" viewBox="0 0 300 72">
      {paths && <path className="fill" d={paths.fill} />}
      {paths && <path className="line" d={paths.line} />}
    </svg>
  );
}
