import React, { Suspense } from "react";
import Link from "next/link";
import {
  Layers,
  ShieldCheck,
  Zap,
  BarChart3,
  CheckCircle,
  Quote,
  Loader2,
} from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50">
      {/* Desktop Left Branding Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-12 text-white">
        {/* Decorative background glow circles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e0e7ff_1px,transparent_1px)] [background-size:24px_24px] opacity-5" />

        {/* Top: Logo & Brand Name */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20 transition-transform group-hover:scale-105">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                BizFlow
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-indigo-300/80 -mt-0.5">
                Enterprise Cloud
              </span>
            </div>
          </Link>
        </div>

        {/* Middle: Value Proposition & 3 Benefit Points */}
        <div className="relative z-10 max-w-lg space-y-8 py-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-400/20 px-3 py-1 text-xs font-semibold text-indigo-300">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span>Multi-Tenant Enterprise Portal</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
              Welcome back to your workspace.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Access your tenant analytics, billing operations, and workspace settings with
              secure role-based authentication.
            </p>
          </div>

          <div className="space-y-4">
            {/* Benefit Point 1 */}
            <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/[0.08]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                <Zap className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-white">Instant Workspace Access</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Single sign-on across all your company workspaces, tenant roles, and subscription metrics.
                </p>
              </div>
            </div>

            {/* Benefit Point 2 */}
            <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/[0.08]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-white">Protected Sessions</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Cryptographically verified JWT bearer tokens with automatic session security and audit tracing.
                </p>
              </div>
            </div>

            {/* Benefit Point 3 */}
            <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/[0.08]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-white">Continuous Monitoring</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Real-time visibility into usage metrics, active seats, and multi-tenant operational status.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Testimonial & Security Badges */}
        <div className="relative z-10 border-t border-white/10 pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <Quote className="h-5 w-5 text-indigo-400/60 shrink-0 mt-0.5" />
            <p className="text-xs italic text-slate-300">
              &ldquo;BizFlow provides the reliable foundation our organization depends on for daily operations.&rdquo;
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              99.99% Uptime SLA
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-indigo-400" />
              Multi-Region Ready
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-violet-400" />
              Owner RBAC Built-in
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Login Form Card */}
      <div className="flex-1 flex flex-col justify-center px-4 py-8 sm:px-8 md:px-12 lg:px-10 xl:px-16 overflow-y-auto">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile-Only Header Brand Bar */}
          <div className="lg:hidden mb-6 flex items-center justify-between pb-4 border-b border-slate-200">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                BizFlow
              </span>
            </Link>
            <Link
              href="/register"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Register
            </Link>
          </div>

          {/* Form Card Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100/80 text-xs font-semibold text-indigo-700 mb-3">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600" />
              <span>Secure Authentication</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Sign in to your account
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter your credentials to access your tenant dashboard.
            </p>
          </div>

          {/* Form Container Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50">
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  <p className="text-xs text-slate-400">Loading sign-in form...</p>
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          {/* Bottom Copyright */}
          <p className="mt-8 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} BizFlow Technologies Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
