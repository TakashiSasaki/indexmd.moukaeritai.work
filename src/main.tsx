import React, { Component, ReactNode, StrictMode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign cross-origin iframe/extension "Script error." and HMR WebSocket connection errors from bubbling up to the test environment.
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    // Ignore generic "Script error." or benign developer connection errors
    if (
      event.message === "Script error." || 
      event.message?.includes("Script error") ||
      event.message?.includes("vite") ||
      event.message?.includes("WebSocket")
    ) {
      console.warn("Muted benign context error:", event.message, event);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || String(event.reason || "");
    if (
      reason.includes("vite") || 
      reason.includes("WebSocket") || 
      reason.includes("HMR") || 
      reason.includes("Script error")
    ) {
      console.warn("Muted benign HMR/WebSocket rejection:", reason);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', color: 'red'}}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
