import { useCallback, useRef } from "react";

/**
 * Ignores overlapping async work (e.g. double-clicks before React applies `disabled`
 * from state). Returns the result of `work`, or `undefined` if a call was skipped.
 */
export function useSubmitGuard() {
  const inFlightRef = useRef(false);

  return useCallback(async function runGuarded<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (inFlightRef.current) return undefined;
    inFlightRef.current = true;
    try {
      return await work();
    } finally {
      inFlightRef.current = false;
    }
  }, []);
}
