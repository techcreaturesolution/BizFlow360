"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getAccessToken, getUser } from "@/lib/storage";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const user = getUser();

    if (!token) {
      setIsAuthenticated(false);
      router.replace("/login");
    } else if (user?.roles?.includes("SUPER_ADMIN")) {
      // Super Admin should be redirected to platform panel, not tenant dashboard
      setIsAuthenticated(false);
      router.replace("/super-admin/dashboard");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500">Checking authentication...</p>
      </div>
    );
  }

  return <>{children}</>;
}
