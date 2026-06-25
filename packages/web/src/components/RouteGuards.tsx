import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function RequireUnlockedVault({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isUnlocked = useAuthStore((s) => s.isUnlocked);

  if (!accessToken) return <Navigate to="/login" replace />;
  if (!isUnlocked) return <Navigate to="/lock" replace />;
  return <>{children}</>;
}

export function RequireAuthenticated({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isUnlocked = useAuthStore((s) => s.isUnlocked);
  if (accessToken && isUnlocked) return <Navigate to="/vault" replace />;
  if (accessToken && !isUnlocked) return <Navigate to="/lock" replace />;
  return <>{children}</>;
}
