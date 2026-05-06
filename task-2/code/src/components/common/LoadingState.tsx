import { Loader2 } from "lucide-react";

export const LoadingState = ({ label = "Loading..." }: { label?: string }) => (
  <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
    <span className="text-sm">{label}</span>
  </div>
);
