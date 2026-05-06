import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { HostLayout } from "@/components/layout/HostLayout";
import { RoleGuard } from "@/components/common/RoleGuard";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LoadingState } from "@/components/common/LoadingState";

import Home from "./pages/Home";
import EventsBrowse from "./pages/EventsBrowse";
import EventDetails from "./pages/EventDetails";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";

const Tickets = lazy(() => import("./pages/Tickets"));
const HostProfile = lazy(() => import("./pages/HostProfile"));
const MyEvents = lazy(() => import("./pages/MyEvents"));
const BecomeHost = lazy(() => import("./pages/BecomeHost"));
const HostDashboard = lazy(() => import("./pages/host/HostDashboard"));
const HostMyEvents = lazy(() => import("./pages/host/HostMyEvents"));
const EventEditor = lazy(() => import("./pages/host/EventEditor"));
const CheckIn = lazy(() => import("./pages/host/CheckIn"));
const GalleryModeration = lazy(() => import("./pages/host/GalleryModeration"));
const ReportsReview = lazy(() => import("./pages/host/ReportsReview"));
const InviteHosts = lazy(() => import("./pages/host/InviteHosts"));
const HostProfileView = lazy(() => import("./pages/host/HostProfileView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/events" element={<EventsBrowse />} />
                  <Route path="/events/:id" element={<EventDetails />} />
                  <Route path="/hosts/:id" element={<HostProfile />} />
                  <Route path="/tickets" element={<RoleGuard roles={["user","host","checker","admin"]}><Tickets /></RoleGuard>} />
                  <Route path="/my-events" element={<RoleGuard roles={["user","host","checker","admin"]}><MyEvents /></RoleGuard>} />
                </Route>

                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />

                <Route element={<PublicLayout />}>
                  <Route path="/become-host" element={<BecomeHost />} />
                </Route>

                <Route element={<HostLayout />}>
                  <Route path="/host" element={<HostDashboard />} />
                  <Route path="/host/events" element={<HostMyEvents />} />
                  <Route path="/host/events/new" element={<EventEditor />} />
                  <Route path="/host/events/:id/edit" element={<EventEditor />} />
                  <Route path="/host/check-in" element={<CheckIn />} />
                  <Route path="/host/gallery" element={<GalleryModeration />} />
                  <Route path="/host/reports" element={<ReportsReview />} />
                  <Route path="/host/invite" element={<InviteHosts />} />
                  <Route path="/host/profile" element={<HostProfileView />} />
                  <Route path="/host/profile/edit" element={<BecomeHost />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
