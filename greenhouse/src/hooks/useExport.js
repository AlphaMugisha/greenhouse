import { useState, useCallback, useRef, useEffect } from "react";
import { downloadWorkbook } from "../lib/exportWorkbook";

// Drives the Export button: one download at a time, with the current
// stage visible so a slow export does not look like a dead button.
export function useExport() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setDone("");
    setStage("Starting…");
    try {
      const { readings, errors } = await downloadWorkbook(s => {
        if (alive.current && typeof s === "string") setStage(s);
      });
      if (!alive.current) return;
      setDone(`${readings} readings and ${errors} errors downloaded`);
    } catch (e) {
      if (!alive.current) return;
      setError(e.message || "Export failed");
    } finally {
      if (alive.current) { setBusy(false); setStage(""); }
    }
  }, [busy]);

  // clear the result so the button returns to its resting state
  useEffect(() => {
    if (!error && !done) return;
    const t = setTimeout(() => {
      if (!alive.current) return;
      setError("");
      setDone("");
    }, 6000);
    return () => clearTimeout(t);
  }, [error, done]);

  return { run, busy, stage, error, done };
}
