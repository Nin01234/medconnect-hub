import { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "./index.css";
import { installDevConsoleNoiseFilter } from "./dev/consoleNoiseFilter";

installDevConsoleNoiseFilter();

type RootErrorBoundaryState = { hasError: boolean; message?: string };

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    const message = error instanceof Error ? error.message : "Unexpected application error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Root render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-6">
          <div className="max-w-xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
            <h1 className="text-xl font-semibold">Unable to load app</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A runtime error occurred during startup. Refresh the page after checking environment configuration.
            </p>
            {this.state.message ? (
              <pre className="mt-4 overflow-auto rounded-md bg-muted p-3 text-xs">{this.state.message}</pre>
            ) : null}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
