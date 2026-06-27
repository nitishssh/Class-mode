import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in the routed page tree so a single bad page shows a
 * recoverable fallback instead of unmounting the entire app to a blank screen.
 * Reset is keyed by location: navigating to a different route clears the error.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the console signal for debugging; the UI no longer goes blank.
    console.error("Page render error caught by ErrorBoundary:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Something went wrong on this page</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              The rest of the app is fine. Try again, or use the sidebar to go somewhere else.
            </p>
          </div>
          <Button onClick={this.reset} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
