import { useState, useEffect } from "react";

// One shared clock. Everything time-dependent — uptime, "3m ago",
// whether the link has gone quiet — recomputes from a render triggered
// here, instead of each component owning its own interval.
export function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN(n => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
