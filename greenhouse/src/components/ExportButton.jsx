import { Download, AlertCircle, Check } from "lucide-react";
import { useExport } from "../hooks/useExport";

// Downloads every row in the database as a two-sheet .xlsx. It is not
// limited by whatever the page happens to be showing.
//
// `variant` picks the shell, not the behaviour: "nav" sits in the
// masthead beside History and Errors, "chip" sits in a log toolbar.
export function ExportButton({ variant = "chip" }) {
  const { run, busy, stage, error, done } = useExport();
  const nav = variant === "nav";

  const label =
    busy ? (nav ? "Exporting…" : stage || "Working…")
    : error ? "Export failed"
    : done ? "Downloaded"
    : nav ? "Export" : "Export Excel";

  const Icon = error ? AlertCircle : done ? Check : Download;

  const cls = nav
    ? "nav-btn export-nav" + (error ? " alert" : "")
    : "chip export-chip" + (busy ? " busy" : "");

  return (
    <span className={nav ? "export-wrap nav" : "export-wrap"}>
      <button
        className={cls}
        onClick={run}
        disabled={busy}
        title={error || "Download all readings and errors as an Excel workbook"}
      >
        {busy
          ? <span className="spinner sm" />
          : <Icon size={nav ? 14 : 13} aria-hidden="true" />}
        {label}
      </button>

      {/* the masthead has no room for a second line of text */}
      {!nav && (error || done) && (
        <span className={"export-note" + (error ? " bad" : "")}>
          {error || done}
        </span>
      )}
    </span>
  );
}
