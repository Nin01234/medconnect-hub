import * as Sentry from "npm:@sentry/deno";

const sentryDsn = Deno.env.get("SENTRY_DSN") ?? "";
const runtimeEnv =
  Deno.env.get("ENVIRONMENT") ??
  (Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "development");
const sentryEnabled = sentryDsn.length > 0;

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    // Keep privacy-safe defaults for backend telemetry.
    sendDefaultPii: false,
    environment: runtimeEnv,
    tracesSampleRate: runtimeEnv === "production" ? 0.1 : 1.0,
  });
}

type SentryContext = {
  functionName: string;
  requestId?: string;
  extra?: Record<string, unknown>;
};

export async function captureEdgeException(error: unknown, context: SentryContext): Promise<void> {
  if (!sentryEnabled) return;

  Sentry.withScope((scope) => {
    scope.setTag("edge.function", context.functionName);
    if (context.requestId) scope.setTag("request.id", context.requestId);
    if (context.extra) scope.setContext("edge_context", context.extra);
    Sentry.captureException(error);
  });

  await Sentry.flush(2000);
}
