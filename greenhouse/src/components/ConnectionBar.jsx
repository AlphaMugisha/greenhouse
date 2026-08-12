import { Wifi, WifiOff } from "lucide-react";

export function ConnectionBar({ offline, seconds }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const Icon = offline ? WifiOff : Wifi;

  return (
    <div className={"connection-status " + (offline ? "offline" : "online")}>
      <div className="icon-container">
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className="status-text">
        <span className="title">{offline ? "Sensor connection lost" : "Sensor connected"}</span>
        <span className="subtitle">
          {offline ? "Showing cached readings" : "Receiving live data"}
        </span>
      </div>
      <div className="timer">{mm}:{ss}</div>
    </div>
  );
}
