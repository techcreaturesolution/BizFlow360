"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldAlert, LogOut, ArrowLeft } from "lucide-react";
import { clearAuth, getAccessToken, getUser } from "@/lib/storage";
import { Button } from "@/components/ui/Button";

interface SuperAdminGuardProps {
  children: React.ReactNode;
}

export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "authorized" | "forbidden" | "unauthenticated">("checking");

  useEffect(() => {
    const token = getAccessToken();
    const user = getUser();

    if (!token) {
      setStatus("unauthenticated");
      router.replace("/login");
      return;
    }

    if (!user?.roles?.includes("SUPER_ADMIN")) {
      setStatus("forbidden");
      return;
    }

    setStatus("authorized");
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  if (status === "checking" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium text-slate-300">Verifying Super Admin authorization...</p>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-200 bg-white p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Access Restricted
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Forbidden: Super Admin access required. Your account does not have platform-level
              privileges to access the administration panel.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Link href="/dashboard" className="w-full">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Go to Tenant Dashboard
              </Button>
            </Link>

            <Button
              variant="outline"
              size="md"
              onClick={handleLogout}
              className="w-full text-slate-600 hover:text-rose-600"
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Sign In as Super Admin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
