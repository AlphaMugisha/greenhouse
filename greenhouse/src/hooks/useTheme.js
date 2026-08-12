import { useState, useEffect, useCallback } from "react";

// The theme is already on <html> before React boots (see index.html),
// so this picks up that value rather than deciding it again and
// causing a flash.
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("glasshouse-theme", theme); } catch (e) {}
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => (t === "dark" ? "light" : "dark"));
  }, []);

  return [theme, toggle];
}
