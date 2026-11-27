import React from "react";
import Link from "next/link";
import { Lock, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ModuleLockedStateProps {
  isEntitlementError?: boolean;
  message?: string;
  moduleName?: string;
}

export function ModuleLockedState({
  isEntitlementError = true,
  message,
  moduleName,
}: ModuleLockedStateProps) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto space-y-5 animate-fadeIn">
      <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
        {isEntitlementError ? (
          <Lock className="h-8 w-8" />
        ) : (
          <ShieldAlert className="h-8 w-8 text-rose-600" />
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">
          {isEntitlementError
            ? `Module Locked${moduleName ? `: ${moduleName}` : ""}`
            : "Permission Denied"}
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {message ||
            (isEntitlementError
              ? "This module is not enabled in your subscription plan. Upgrade your plan to access this functionality."
              : "You do not have administrative permission to view or manage this section.")}
        </p>
      </div>

      {isEntitlementError ? (
        <div className="pt-2">
          <Link href="/dashboard/billing">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="shadow-sm shadow-indigo-600/20"
            >
              Upgrade Plan in Billing
            </Button>
          </Link>
        </div>
      ) : (
        <div className="pt-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Return to Overview
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
