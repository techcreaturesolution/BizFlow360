import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = (status || "TRIAL").toUpperCase();

  const config: Record<
    string,
    { label: string; bg: string; text: string; dot: string; border: string }
  > = {
    // Tenant & Subscription Statuses
    TRIAL: {
      label: "Trial",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      dot: "bg-indigo-600",
      border: "border-indigo-200",
    },
    ACTIVE: {
      label: "Active",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    PAST_DUE: {
      label: "Past Due",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-600",
      border: "border-amber-200",
    },
    GRACE: {
      label: "Grace Period",
      bg: "bg-yellow-50",
      text: "text-yellow-800",
      dot: "bg-yellow-600",
      border: "border-yellow-200",
    },
    SUSPENDED: {
      label: "Suspended",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-600",
      border: "border-rose-200",
    },
    CANCELLED: {
      label: "Cancelled",
      bg: "bg-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-500",
      border: "border-slate-300",
    },
    ARCHIVED: {
      label: "Archived",
      bg: "bg-zinc-100",
      text: "text-zinc-600",
      dot: "bg-zinc-400",
      border: "border-zinc-300",
    },
    EXPIRED: {
      label: "Expired",
      bg: "bg-stone-100",
      text: "text-stone-700",
      dot: "bg-stone-500",
      border: "border-stone-300",
    },

    // Invoice Statuses
    DRAFT: {
      label: "Draft",
      bg: "bg-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-400",
      border: "border-slate-200",
    },
    ISSUED: {
      label: "Issued",
      bg: "bg-sky-50",
      text: "text-sky-700",
      dot: "bg-sky-600",
      border: "border-sky-200",
    },
    PAID: {
      label: "Paid",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    OVERDUE: {
      label: "Overdue",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-600",
      border: "border-rose-200",
    },
    VOID: {
      label: "Void",
      bg: "bg-zinc-100",
      text: "text-zinc-500",
      dot: "bg-zinc-400",
      border: "border-zinc-200",
    },

    // Payment Statuses
    SUCCEEDED: {
      label: "Succeeded",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    PENDING: {
      label: "Pending",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
      border: "border-amber-200",
    },
    FAILED: {
      label: "Failed",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-600",
      border: "border-rose-200",
    },
    REFUNDED: {
      label: "Refunded",
      bg: "bg-purple-50",
      text: "text-purple-700",
      dot: "bg-purple-600",
      border: "border-purple-200",
    },

    // Intervals
    MONTHLY: {
      label: "Monthly",
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-500",
      border: "border-blue-200",
    },
    ANNUAL: {
      label: "Annual",
      bg: "bg-violet-50",
      text: "text-violet-700",
      dot: "bg-violet-500",
      border: "border-violet-200",
    },
  };

  const current = config[s] || {
    label: s,
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
    border: "border-slate-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors",
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", current.dot)} />
      <span>{current.label}</span>
    </span>
  );
}
