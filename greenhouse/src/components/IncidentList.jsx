import { errorAge, relativeTime, errorTitle } from "../lib/format";
import { ERROR_ACTIVE_MS } from "../lib/supabase";

// Renders grouped runs, not raw rows: see groupErrors in lib/format.
export function IncidentList({ groups }) {
  return (
    <div className="list">
      {groups.map((g, i) => {
        const recent = errorAge(g.newest) <= ERROR_ACTIVE_MS;
        const newest = new Date(g.newest);
        const oldest = new Date(g.oldest);

        // A run gets the window it spanned; a single fault gets its date.
        const stamp = g.count > 1
          ? `${oldest.toLocaleTimeString()} – ${newest.toLocaleTimeString()}`
          : `${newest.toLocaleDateString()} ${newest.toLocaleTimeString()}`;

        return (
          <div className={"incident" + (recent ? " recent" : "")} key={g.newest + i}>
            <span className="bar" />
            <div className="body">
              <div className="head">
                <span className="name">{errorTitle(g.type)}</span>
                {g.count > 1 && <span className="tally">{g.count}×</span>}
                {recent && <span className="live-tag">active</span>}
              </div>
              <div className="type">{g.type || "UNKNOWN_ERROR"}</div>
              <div className="message">{g.message || "No detail reported."}</div>
            </div>
            <div className="when">
              {relativeTime(g.newest)}
              <span className="abs">{stamp}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
