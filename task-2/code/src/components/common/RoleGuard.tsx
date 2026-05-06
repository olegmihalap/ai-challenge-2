import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/lib/types";
import { Navigate } from "react-router-dom";
import { LoadingState } from "@/components/common/LoadingState";

export const RoleGuard = ({
  roles,
  children,
  fallback,
  redirectTo,
}: {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}) => {
  const { roles: userRoles, loading, user } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/sign-in" replace />;
  const ok = roles.some((r) => userRoles.includes(r));
  if (!ok) {
    if (redirectTo) return <Navigate to={redirectTo} replace />;
    return <>{fallback ?? <div className="container py-20 text-center text-muted-foreground">You don't have access to this page.</div>}</>;
  }
  return <>{children}</>;
};
