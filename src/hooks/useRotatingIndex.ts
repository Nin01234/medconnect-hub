import { useEffect, useState } from "react";

/** Cycles `0 .. length-1` on an interval for rotating headlines and feature sets. */
export function useRotatingIndex(length: number, intervalMs: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (length <= 1) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % length), intervalMs);
    return () => window.clearInterval(t);
  }, [length, intervalMs]);
  return i;
}
