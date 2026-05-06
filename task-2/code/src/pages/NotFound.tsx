import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-soft px-4">
    <div className="max-w-md text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="font-display text-6xl font-bold">404</h1>
      <p className="mt-3 text-lg text-muted-foreground">We couldn't find that page.</p>
      <Button asChild className="mt-6 bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
        <Link to="/">Take me home</Link>
      </Button>
    </div>
  </div>
);

export default NotFound;
