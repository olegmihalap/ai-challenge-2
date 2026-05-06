import { Skeleton } from "@/components/ui/skeleton";

export const EventCardSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
    <Skeleton className="aspect-[16/9] w-full rounded-none" />
    <div className="space-y-3 p-5">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-3 h-9 w-full" />
    </div>
  </div>
);

export const EventGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => <EventCardSkeleton key={i} />)}
  </div>
);

export const EventDetailsSkeleton = () => (
  <div className="container py-8 md:py-12">
    <Skeleton className="h-4 w-32" />
    <div className="mt-6 grid gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  </div>
);
