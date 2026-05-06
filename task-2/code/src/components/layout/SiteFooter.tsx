import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export const SiteFooter = () => (
  <footer className="border-t border-border/60 bg-muted/30">
    <div className="container flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
      <div className="flex items-center gap-2 font-display font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-hero text-primary-foreground"><Sparkles className="h-3.5 w-3.5" /></span>
        Gather
      </div>
      <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Gather. Bringing communities together.</p>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <Link to="/events" className="hover:text-foreground">Browse</Link>
        <Link to="/sign-up" className="hover:text-foreground">Become a host</Link>
      </div>
    </div>
  </footer>
);
