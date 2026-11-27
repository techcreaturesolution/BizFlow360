import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = (status || "ACTIVE").toUpperCase();

  const config: Record<
    string,
    { label: string; bg: string; text: string; dot: string; border: string }
  > = {
    // Tenant & Subscription
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

    // Invoices & Billing
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

    // Payments & Jobs
    SUCCEEDED: {
      label: "Succeeded",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    COMPLETED: {
      label: "Completed",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    PROCESSING: {
      label: "Processing",
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-600",
      border: "border-blue-200",
    },
    QUEUED: {
      label: "Queued",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
      border: "border-amber-200",
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

    // Roles
    OWNER: {
      label: "Owner",
      bg: "bg-purple-50",
      text: "text-purple-700",
      dot: "bg-purple-600",
      border: "border-purple-200",
    },
    ADMIN: {
      label: "Admin",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      dot: "bg-indigo-600",
      border: "border-indigo-200",
    },
    MEMBER: {
      label: "Member",
      bg: "bg-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-500",
      border: "border-slate-200",
    },
    SUPER_ADMIN: {
      label: "Super Admin",
      bg: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-600",
      border: "border-red-200",
    },

    // Tasks & Approvals
    APPROVED: {
      label: "Approved",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    REJECTED: {
      label: "Rejected",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-600",
      border: "border-rose-200",
    },
    TODO: {
      label: "To Do",
      bg: "bg-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-500",
      border: "border-slate-200",
    },
    IN_PROGRESS: {
      label: "In Progress",
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-600",
      border: "border-blue-200",
    },
    IN_REVIEW: {
      label: "In Review",
      bg: "bg-purple-50",
      text: "text-purple-700",
      dot: "bg-purple-600",
      border: "border-purple-200",
    },
    DONE: {
      label: "Done",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },

    // CRM Lead Stages
    NEW: {
      label: "New",
      bg: "bg-sky-50",
      text: "text-sky-700",
      dot: "bg-sky-500",
      border: "border-sky-200",
    },
    CONTACTED: {
      label: "Contacted",
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-500",
      border: "border-blue-200",
    },
    QUALIFIED: {
      label: "Qualified",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      dot: "bg-indigo-600",
      border: "border-indigo-200",
    },
    PROPOSAL: {
      label: "Proposal",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-600",
      border: "border-amber-200",
    },
    NEGOTIATION: {
      label: "Negotiation",
      bg: "bg-violet-50",
      text: "text-violet-700",
      dot: "bg-violet-600",
      border: "border-violet-200",
    },
    WON: {
      label: "Won",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      border: "border-emerald-200",
    },
    LOST: {
      label: "Lost",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-500",
      border: "border-rose-200",
    },

    // Priorities
    LOW: {
      label: "Low",
      bg: "bg-slate-50",
      text: "text-slate-600",
      dot: "bg-slate-400",
      border: "border-slate-200",
    },
    MEDIUM: {
      label: "Medium",
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-500",
      border: "border-blue-200",
    },
    HIGH: {
      label: "High",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
      border: "border-amber-200",
    },
    URGENT: {
      label: "Urgent",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-600",
      border: "border-rose-200",
    },

    // Followups
    MISSED: {
      label: "Missed",
      bg: "bg-rose-50",
      text: "text-rose-700",
      dot: "bg-rose-500",
      border: "border-rose-200",
    },

    // Customer Types
    B2B: {
      label: "B2B",
      bg: "bg-sky-50",
      text: "text-sky-700",
      dot: "bg-sky-500",
      border: "border-sky-200",
    },
    B2C: {
      label: "B2C",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      border: "border-emerald-200",
    },
    ENTERPRISE: {
      label: "Enterprise",
      bg: "bg-purple-50",
      text: "text-purple-700",
      dot: "bg-purple-600",
      border: "border-purple-200",
    },
    PARTNER: {
      label: "Partner",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      dot: "bg-indigo-500",
      border: "border-indigo-200",
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
