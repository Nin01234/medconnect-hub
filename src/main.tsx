import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "./index.css";
import { installDevConsoleNoiseFilter } from "./dev/consoleNoiseFilter";

installDevConsoleNoiseFilter();

const isDev = import.meta.env.DEV;
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    // Keep user privacy by default; do not send IP/user identifiers automatically.
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Use full sampling in development for debugging; lower this in production for cost/perf.
    tracesSampleRate: isDev ? 1.0 : 0.2,
    // Capture 10% of all sessions, but always capture sessions where an error occurs.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-6">
        <div className="max-w-xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We logged this issue and are working on a fix. Please refresh and try again.
          </p>
        </div>
      </div>
    }
  >
    <App />
  </Sentry.ErrorBoundary>
);
