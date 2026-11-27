import React from "react";
import { AlertTriangle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-rose-900">{title}</h4>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{message}</p>
      </div>
      {onRetry && (
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon = <AlertCircle className="h-8 w-8 text-slate-400" />,
  action,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="space-y-1 max-w-sm mx-auto">
        <h4 className="text-base font-bold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {action ? (
        <div className="pt-2">{action}</div>
      ) : actionLabel && onAction ? (
        <div className="pt-2">
          <Button size="sm" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
