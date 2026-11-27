import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = "bg-indigo-50 text-indigo-600",
  trend,
  trendPositive,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-2xl font-black tracking-tight text-slate-900">{value}</h3>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            {trend && (
              <span
                className={cn(
                  "font-bold",
                  trendPositive ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {trend}
              </span>
            )}
            {subtitle && <span className="text-slate-500 truncate">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
