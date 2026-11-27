"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  TrendingUp,
  AlertOctagon,
  Percent,
  Calendar,
  RotateCcw,
  ArrowRight,
  DollarSign,
  Users,
  Eye,
  CheckCircle2,
  PieChart as PieIcon,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

import { getDashboard, parsePlatformError } from "@/lib/platform";
import type { DashboardOverview, TenantStatus } from "@/types/platform";
import { StatCard } from "@/components/super-admin/StatCard";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Button } from "@/components/ui/Button";

const STATUS_COLORS: Record<TenantStatus, string> = {
  TRIAL: "#6366f1", // Indigo
  ACTIVE: "#10b981", // Emerald
  PAST_DUE: "#f59e0b", // Amber
  GRACE: "#eab308", // Yellow
  SUSPENDED: "#f43f5e", // Rose
  CANCELLED: "#64748b", // Slate
  ARCHIVED: "#71717a", // Zinc
};

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (from?: string, to?: string) => {
    setIsLoading(true);
    setError(null);
    setFilterError(null);

    // Validate from <= to
    if (from && to && new Date(from) > new Date(to)) {
      setFilterError("Start date ('from') must be on or before end date ('to')");
      setIsLoading(false);
      return;
    }

    try {
      const overview = await getDashboard({ from, to });
      setData(overview);
      if (overview.period) {
        if (!from) setFromDate(overview.period.from || "");
        if (!to) setToDate(overview.period.to || "");
      }
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleApplyFilter = () => {
    fetchDashboardData(fromDate || undefined, toDate || undefined);
  };

  const handleResetFilter = () => {
    setFromDate("");
    setToDate("");
    setFilterError(null);
    fetchDashboardData();
  };

  const formatCurrency = (amount: number, currency: string = "INR") => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const formatPercentage = (rate: number) => {
    if (rate <= 1 && rate > 0) {
      return `${(rate * 100).toFixed(1)}%`;
    }
    return `${rate.toFixed(1)}%`;
  };

  // Prepare chart data for Tenants by Status
  const pieData = data?.tenants_by_status
    ? (Object.entries(data.tenants_by_status) as [TenantStatus, number][])
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          name: status,
          value: count,
          color: STATUS_COLORS[status] || "#6366f1",
        }))
    : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Top Controls: Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            Platform Health & Metrics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated metrics across all organizations, subscriptions, and financial flows.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 focus:outline-none"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={handleApplyFilter}
            disabled={isLoading}
            className="text-xs font-semibold"
          >
            Apply
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleResetFilter}
            disabled={isLoading}
            leftIcon={<RotateCcw className="h-3 w-3" />}
            className="text-xs"
          >
            Reset
          </Button>
        </div>
      </div>

      {filterError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {filterError}
        </div>
      )}

      {error && !isLoading && (
        <ErrorState
          title="Failed to Load Dashboard"
          message={error}
          onRetry={() => fetchDashboardData(fromDate, toDate)}
        />
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-80 rounded-2xl bg-slate-200" />
            <div className="h-80 rounded-2xl bg-slate-200" />
            <div className="h-80 rounded-2xl bg-slate-200" />
          </div>
          <div className="h-64 rounded-2xl bg-slate-200" />
        </div>
      )}

      {/* Dashboard Metrics Content */}
      {!isLoading && data && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              title="Total Tenants"
              value={data.total_tenants}
              subtitle="Registered workspaces"
              icon={<Building2 className="h-5 w-5" />}
              iconBg="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              title="Active Subs"
              value={data.active_subscriptions}
              subtitle="Current paid accounts"
              icon={<CreditCard className="h-5 w-5" />}
              iconBg="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Total MRR"
              value={formatCurrency(data.mrr)}
              subtitle="Monthly recurring"
              icon={<TrendingUp className="h-5 w-5" />}
              iconBg="bg-blue-50 text-blue-600"
            />
            <StatCard
              title="Total ARR"
              value={formatCurrency(data.arr)}
              subtitle="Annualized run rate"
              icon={<DollarSign className="h-5 w-5" />}
              iconBg="bg-violet-50 text-violet-600"
            />
            <StatCard
              title="Failed Payments"
              value={data.failed_payments_count}
              subtitle="Pending resolution"
              icon={<AlertOctagon className="h-5 w-5" />}
              iconBg={
                data.failed_payments_count > 0
                  ? "bg-rose-50 text-rose-600"
                  : "bg-slate-100 text-slate-500"
              }
            />
            <StatCard
              title="Churn Rate"
              value={formatPercentage(data.churn_rate)}
              subtitle="Over selected range"
              icon={<Percent className="h-5 w-5" />}
              iconBg="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Middle Row: Status Breakdown + Currency Revenue + Plan Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Tenants by Status */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-indigo-600" />
                  Tenants by Lifecycle Status
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribution across operational stages
                </p>
              </div>

              {pieData.length > 0 ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`${val ?? 0} tenants`, "Count"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  No tenant data available for chart.
                </div>
              )}

              {/* Status List */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {(
                  [
                    "TRIAL",
                    "ACTIVE",
                    "PAST_DUE",
                    "GRACE",
                    "SUSPENDED",
                    "CANCELLED",
                    "ARCHIVED",
                  ] as TenantStatus[]
                ).map((status) => {
                  const count = data.tenants_by_status?.[status] ?? 0;
                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <StatusBadge status={status} />
                      <span className="font-bold text-slate-800">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Revenue by Currency */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Revenue by Currency
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Breakdown by billing denomination
                </p>
              </div>

              {data.revenue_by_currency && data.revenue_by_currency.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {data.revenue_by_currency.map((rev) => (
                    <div
                      key={rev.currency}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-sm">
                          {rev.currency}
                        </span>
                        <span className="text-xs text-slate-500">Live active</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 uppercase font-semibold">
                            MRR
                          </span>
                          <p className="font-bold text-slate-900 text-sm">
                            {formatCurrency(rev.mrr, rev.currency)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 uppercase font-semibold">
                            ARR
                          </span>
                          <p className="font-bold text-slate-900 text-sm">
                            {formatCurrency(rev.arr, rev.currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No localized currency revenue recorded yet.
                </div>
              )}
            </div>

            {/* Card 3: Plan Mix */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-600" />
                  Subscription Plan Mix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tenant distribution per subscription tier
                </p>
              </div>

              {data.plan_mix && data.plan_mix.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {data.plan_mix.map((item, idx) => {
                    const planName = item.plan_name || (item.plan_id ? "Custom Plan" : "No Plan");
                    const percentage =
                      data.total_tenants > 0
                        ? Math.round((item.tenant_count / data.total_tenants) * 100)
                        : 0;

                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {planName}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {item.tenant_count} tenants ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(percentage, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No active plan mix metrics recorded.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Table: Recent Tenants */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Recently Registered Tenants
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest customer organizations provisioned on the platform
                </p>
              </div>
              <Link
                href="/super-admin/tenants"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
              >
                <span>View all tenants</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {data.recent_tenants && data.recent_tenants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4">Workspace Domain</th>
                      <th className="py-3 px-4">Account Owner</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent_tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {t.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-indigo-600">
                          {t.slug}.bizflow.app
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-medium text-slate-800">
                            {t.owner?.full_name || "System"}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {t.owner?.email || "-"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/super-admin/tenants/${t.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Eye className="h-3 w-3" />}
                              className="text-xs h-7 px-2.5"
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent tenants registered yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
