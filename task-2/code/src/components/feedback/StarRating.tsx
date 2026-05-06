import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}

const sizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" };

export const StarRating = ({ value, onChange, size = "md", readOnly }: Props) => {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const Cmp = readOnly || !onChange ? "span" : "button";
        return (
          <Cmp
            key={n}
            type={Cmp === "button" ? "button" : undefined}
            onClick={Cmp === "button" ? () => onChange!(n) : undefined}
            className={cn(
              Cmp === "button" && "transition-transform hover:scale-110",
              "p-0.5"
            )}
            aria-label={Cmp === "button" ? `Rate ${n} star${n > 1 ? "s" : ""}` : undefined}
          >
            <Star
              className={cn(
                sizes[size],
                filled ? "fill-warning text-warning" : "fill-transparent text-muted-foreground/40"
              )}
            />
          </Cmp>
        );
      })}
    </div>
  );
};
