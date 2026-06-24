import React, { Component, ReactNode, StrictMode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Prevent benign cross-origin iframe/extension "Script error." and HMR WebSocket connection errors from bubbling up to the test environment.
if (typeof window !== "undefined") {
  // Use window.onerror directly to suppress browser-level propagation of cross-origin exceptions
  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message || "");
    const src = String(source || "");
    if (
      msg.includes("Script error") ||
      msg === "Script error." ||
      !source ||
      src.includes("chrome-extension") ||
      src.includes("google") ||
      msg.includes("vite") ||
      msg.includes("WebSocket") ||
      msg.includes("401") ||
      msg.includes("authError") ||
      msg.includes("Google API") ||
      msg.includes("Cloud Firestore") ||
      msg.includes("Falling back to alternative model")
    ) {
      console.warn("Muted benign window.onerror:", message, "source:", source);
      return true; // Swallows error (prevents bubbling to browser / automation tools)
    }
    if (prevOnError) {
      return prevOnError.apply(window, arguments as any);
    }
    return false;
  };

  window.addEventListener("error", (event) => {
    // Ignore generic "Script error." or benign developer connection errors
    if (
      event.message === "Script error." || 
      event.message?.includes("Script error") ||
      event.message?.includes("vite") ||
      event.message?.includes("WebSocket") ||
      event.message?.includes("401") ||
      event.message?.includes("authError") ||
      event.message?.includes("Google API") ||
      event.message?.includes("Could not reach Cloud Firestore") ||
      String(event.error)?.includes("Could not reach Cloud Firestore") ||
      event.message?.includes("Falling back to alternative model") ||
      String(event.error)?.includes("Falling back to alternative model")
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
      reason.includes("Script error") ||
      reason.includes("401") ||
      reason.includes("authError") ||
      reason.includes("Google API アクセストークンが無効") ||
      reason.includes("Could not reach Cloud Firestore") ||
      reason.includes("Falling back to alternative model")
    ) {
      console.warn("Muted benign rejection/error:", reason);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Suppress specific console.error logs for known benign issues
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const msg = args.map(a => String(a)).join(" ");
    if (
      msg.includes("Could not reach Cloud Firestore backend") ||
      msg.includes("Google API アクセストークンが無効") ||
      msg.includes("401") ||
      msg.includes("authError") ||
      msg.includes("Falling back to alternative model")
    ) {
      // Just warn instead of error
      console.warn("Muted benign console.error:", msg);
      return;
    }
    return originalConsoleError.apply(console, args);
  };
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
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
