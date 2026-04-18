const NOISY_PATTERNS: RegExp[] = [
  /Download the React DevTools for a better development experience/i,
  /\[TermOver AI\]/i,
  /ga4-measurement loaded/i,
  /^CANDIDATES:\s/i,
];

const shouldSuppress = (args: unknown[]) => {
  const text = args
    .map((value) => (typeof value === "string" ? value : ""))
    .join(" ");
  return NOISY_PATTERNS.some((pattern) => pattern.test(text));
};

const patchConsoleMethod = <T extends (...args: unknown[]) => void>(method: T): T => {
  return ((...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    method(...args);
  }) as T;
};

export const installDevConsoleNoiseFilter = () => {
  if (!import.meta.env.DEV) return;
  if ((window as Window & { __consoleNoiseFilterInstalled?: boolean }).__consoleNoiseFilterInstalled) return;

  (window as Window & { __consoleNoiseFilterInstalled?: boolean }).__consoleNoiseFilterInstalled = true;

  console.log = patchConsoleMethod(console.log.bind(console));
  console.info = patchConsoleMethod(console.info.bind(console));
  console.warn = patchConsoleMethod(console.warn.bind(console));
};
