import { ArrowUp, ArrowDown, Minus } from "lucide-react";

// Change since the previous reading. Anything under 0.05 counts as
// steady, so the badge does not flicker on sensor noise.
export function Delta({ curr, prev, digits = 1 }) {
  if (prev === undefined || !Number.isFinite(curr) || Math.abs(curr - prev) < 0.05) {
    return (
      <span className="delta-badge steady">
        <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }

  const up = curr > prev;
  const Arrow = up ? ArrowUp : ArrowDown;

  return (
    <span className={"delta-badge " + (up ? "up" : "down")}>
      <Arrow size={12} strokeWidth={2.5} aria-hidden="true" />
      {Math.abs(curr - prev).toFixed(digits)}
    </span>
  );
}
