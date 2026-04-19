import { useCallback, useRef } from "react";

/**
 * Debounces a zero-arg callback (e.g. refetch). Returns [run, cancel] for use in effects.
 */
export function useDebouncedCallback(fn: () => void, delayMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const idRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(() => {
    if (idRef.current) clearTimeout(idRef.current);
    idRef.current = setTimeout(() => {
      idRef.current = null;
      fnRef.current();
    }, delayMs);
  }, [delayMs]);

  const cancel = useCallback(() => {
    if (idRef.current) {
      clearTimeout(idRef.current);
      idRef.current = null;
    }
  }, []);

  return [run, cancel] as const;
}
