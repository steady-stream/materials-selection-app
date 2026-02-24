import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary — catches any render-time JS crashes and displays
 * them on screen rather than showing a blank page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-8">
          <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8 border border-red-200">
            <h1 className="text-xl font-bold text-red-700 mb-2">
              Application Error
            </h1>
            <p className="text-sm text-gray-600 mb-4">
              The application failed to load. Please share this error with your
              administrator.
            </p>
            <pre className="bg-red-50 border border-red-100 rounded p-4 text-xs text-red-800 whitespace-pre-wrap break-all overflow-auto max-h-64">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
