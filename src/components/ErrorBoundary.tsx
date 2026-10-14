/**
 * src/components/ErrorBoundary.tsx
 *
 * React Error Boundary with friendly fallback and application reset.
 * Ensures rendering errors in any subcomponent do not crash the entire application.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            background: "#f8fafc",
            color: "#0f172a",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "2.5rem 2rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 0.5rem 0",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#64748b",
                lineHeight: 1.5,
                margin: "0 0 1.5rem 0",
              }}
            >
              An unexpected error occurred while rendering the interface. Your decentralized state on
              Arkiv remains completely secure and untouched.
            </p>

            {this.state.error && (
              <pre
                style={{
                  background: "#f1f5f9",
                  padding: "0.75rem 1rem",
                  borderRadius: 6,
                  fontSize: "0.78rem",
                  color: "#dc2626",
                  textAlign: "left",
                  overflowX: "auto",
                  marginBottom: "1.5rem",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <button
              onClick={this.handleReset}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                padding: "0.6rem 1.5rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#2563eb")}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
