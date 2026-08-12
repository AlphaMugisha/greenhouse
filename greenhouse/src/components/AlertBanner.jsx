import { TriangleAlert, X } from "lucide-react";
import { errorAge, relativeTime } from "../lib/format";
import { ERROR_ACTIVE_MS } from "../lib/supabase";

// Only the newest fault, and only while it is still current. The full
// log lives on its own route.
export function AlertBanner({ errors, dismissed, onDismiss }) {
  const latest = errors[0];
  const show = latest
    && latest.id !== dismissed
    && errorAge(latest.created_at) <= ERROR_ACTIVE_MS;

  if (!show) return null;

  return (
    <div className="alert-banner">
      <TriangleAlert className="alert-icon" size={18} aria-hidden="true" />
      <div className="alert-text">
        <span className="alert-title">{latest.error_type || "SENSOR ERROR"}</span>
        <span className="alert-detail">
          {latest.error_message || "The board reported an error with no detail."}
        </span>
      </div>
      <div className="alert-time">{relativeTime(latest.created_at)}</div>
      <button
        className="alert-close"
        title="Dismiss"
        aria-label="Dismiss this alert"
        onClick={() => onDismiss(latest.id)}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
