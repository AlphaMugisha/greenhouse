import { useEffect } from "react";

// The preloader lives in index.html so it is painted before React
// loads. It lifts when the first data settles, and on a timer whatever
// happens, so it can never trap the page behind it.
export function usePreloader(ready) {
  useEffect(() => {
    const lift = () => document.getElementById("preloader")?.classList.add("done");
    if (ready) lift();
    const t = setTimeout(lift, 5000);
    return () => clearTimeout(t);
  }, [ready]);
}
