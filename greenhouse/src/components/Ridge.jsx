import { Link } from "react-router-dom";
import { Sun, Moon, Timer, ArrowLeft } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

// The masthead every route shares. `nav` is whatever links belong on
// this page; the theme control is always present.
export function Ridge({ title, subtitle, status, uptime, readouts, nav }) {
  const [theme, toggleTheme] = useTheme();
  const dark = theme === "dark";

  return (
    <header className="ridge">
      <div className="ridge-top">
        <div className="brand">
          <h1>{title} <span>{subtitle}</span></h1>
        </div>
        <div className="status-group">
          {status && (
            <div className="status-pill">
              <span className={"status-dot " + status.kind} />
              <span>{status.text}</span>
            </div>
          )}
          {uptime && (
            <div className="uptime-badge">
              <Timer size={12} aria-hidden="true" /> {uptime}
            </div>
          )}
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {/* the icon shows what you get, not what you have */}
            {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {(readouts || nav) && (
        <div className="ridge-bar">
          <div className="readouts">
            {readouts?.map(r => (
              <span className="readout" key={r.label}>
                {r.label} <b>{r.value}</b>
              </span>
            ))}
          </div>
          <nav className="ridge-nav">{nav}</nav>
        </div>
      )}
    </header>
  );
}

export function BackLink() {
  return (
    <Link className="nav-btn" to="/">
      <ArrowLeft className="arrow" size={14} aria-hidden="true" /> Live dashboard
    </Link>
  );
}
