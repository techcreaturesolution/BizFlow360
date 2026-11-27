"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  LogOut,
  User,
  Building2,
  Mail,
  Phone,
  Shield,
  Globe,
  Clock,
  DollarSign,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { getMe } from "@/lib/auth";
import { clearAuth, getTenant, getUser } from "@/lib/storage";
import type { LoginUser, TenantInfo } from "@/types/auth";
import { Button } from "@/components/ui/Button";

function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<LoginUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async () => {
    setIsLoading(true);
    setError(null);

    // Initial check from local storage for fast paint
    const storedTenant = getTenant();
    if (storedTenant) {
      setTenant(storedTenant);
    }

    try {
      const fetchedUser = await getMe();
      setUser(fetchedUser);

      // Refresh tenant from storage if available
      const currentTenant = getTenant();
      if (currentTenant) {
        setTenant(currentTenant);
      }
    } catch (err: unknown) {
      console.error("Failed to load user profile:", err);
      setError("Failed to fetch fresh user profile. Your session may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const getStatusBadge = (status?: string) => {
    const s = status?.toUpperCase() || "ACTIVE";
    if (s === "TRIAL") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
          Trial
        </span>
      );
    }
    if (s === "ACTIVE") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
        {s}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-600/20">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                BizFlow
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 -mt-1">
                Workspace Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {tenant?.slug && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-xs font-mono font-medium text-indigo-700">
                <Globe className="h-3.5 w-3.5" />
                {tenant.slug}.bizflow.app
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut className="h-4 w-4 text-slate-500" />}
              className="text-xs font-semibold text-slate-700 hover:text-rose-600 hover:border-rose-300 transition-colors"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-72 rounded-2xl bg-slate-200" />
              <div className="h-72 rounded-2xl bg-slate-200" />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && !isLoading && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-rose-900">Session Error</h4>
                <p className="mt-0.5 text-xs text-rose-700">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={fetchUserData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
                Retry
              </Button>
              <Button size="sm" variant="danger" onClick={handleLogout}>
                Login again
              </Button>
            </div>
          </div>
        )}

        {/* Loaded Content */}
        {!isLoading && user && (
          <div className="space-y-8 animate-fadeIn">
            {/* Welcome Banner */}
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-0.5 text-xs font-semibold text-indigo-300">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Authenticated Session Active</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Welcome, {user.fullName}!
                  </h1>
                  <p className="text-sm text-indigo-200/90">
                    {tenant?.name
                      ? `Managing ${tenant.name} (${tenant.slug})`
                      : "Multi-Tenant Enterprise Workspace"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(tenant?.status)}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: User Profile */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">User Profile</h2>
                    <p className="text-xs text-slate-500">Your account identity & credentials</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                      Full Name
                    </span>
                    <span className="font-semibold text-slate-900">{user.fullName}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      Email
                    </span>
                    <span className="font-medium text-slate-800">{user.email}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      Phone
                    </span>
                    <span className="text-slate-700">
                      {user.phone || <span className="text-slate-400 italic">Not provided</span>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-slate-400" />
                      Assigned Roles
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles && user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100"
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Standard User</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                      User ID
                    </span>
                    <span className="font-mono text-xs text-slate-400 select-all">{user.id}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Company Workspace Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Tenant Workspace</h2>
                    <p className="text-xs text-slate-500">Multi-tenant isolation & configurations</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                      Company Name
                    </span>
                    <span className="font-semibold text-slate-900">
                      {tenant?.name || "Apex Solutions"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      Workspace Slug
                    </span>
                    <span className="font-mono text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {tenant?.slug || "apex-solutions"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                      Workspace Status
                    </span>
                    <div>{getStatusBadge(tenant?.status)}</div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Timezone
                    </span>
                    <span className="font-medium text-slate-800">
                      {tenant?.timezone || "Asia/Kolkata"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                      Default Currency
                    </span>
                    <span className="font-medium text-slate-800">
                      {tenant?.defaultCurrency || "INR"}
                    </span>
                  </div>

                  {tenant?.id && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                        Tenant ID
                      </span>
                      <span className="font-mono text-xs text-slate-400 select-all">{tenant.id}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
