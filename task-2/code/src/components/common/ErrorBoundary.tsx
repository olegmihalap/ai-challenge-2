import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">{this.state.error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { this.setState({ error: null }); }}>Try again</Button>
          <Button variant="outline" onClick={() => { window.location.href = "/"; }}>Go home</Button>
        </div>
      </div>
    );
  }
}
