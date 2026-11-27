"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  TrendingUp,
  Receipt,
  CreditCard,
  CheckSquare,
  Users,
  Coins,
  ArrowRight,
  Filter,
  RefreshCw,
  Sliders,
  Calendar,
  Globe,
  Clock,
  Mail,
  Phone,
  Shield,
  Building2,
  ExternalLink,
  Plus,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Check,
  AlertCircle,
  FileText,
  Activity,
  BarChart3,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { getMe } from "@/lib/auth";
import { getTenant, getUser } from "@/lib/storage";
import {
  getBranches,
  getDashboardSummary,
  getDashboardWidgets,
  getDepartments,
  saveDashboardWidgets,
} from "@/lib/tenant";
import {
  formatKeyToTitle,
  formatMetricValue,
  detectMetricType,
} from "@/lib/normalize";
import type { LoginUser, TenantInfo } from "@/types/auth";
import type {
  BranchItem,
  DashboardPeriod,
  DashboardWidgetConfig,
  DepartmentItem,
} from "@/types/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  {
    widgetId: "widget-revenue",
    type: "REVENUE_KPI",
    title: "Financial Performance",
    position: { x: 0, y: 0, w: 12, h: 4 },
    isVisible: true,
  },
  {
    widgetId: "widget-pipeline",
    type: "PIPELINE",
    title: "Sales & Pipeline",
    position: { x: 0, y: 4, w: 6, h: 4 },
    isVisible: true,
  },
  {
    widgetId: "widget-due-invoices",
    type: "DUE_INVOICES",
    title: "Due Invoices & Receivables",
    position: { x: 6, y: 4, w: 6, h: 4 },
    isVisible: true,
  },
  {
    widgetId: "widget-expenses",
    type: "EXPENSES",
    title: "Expenses & Cash Outflow",
    position: { x: 0, y: 8, w: 6, h: 4 },
    isVisible: true,
  },
  {
    widgetId: "widget-tasks",
    type: "TASKS",
    title: "Pending Tasks & Deadlines",
    position: { x: 6, y: 8, w: 6, h: 4 },
    isVisible: true,
  },
  {
    widgetId: "widget-org-counts",
    type: "ORG_COUNTS",
    title: "Organization Headcount & Scale",
    position: { x: 0, y: 12, w: 6, h: 4 },
    isVisible: true,
  },
  {
    widgetId: "widget-activity",
    type: "RECENT_ACTIVITY",
    title: "Recent Workspace Activity",
    position: { x: 6, y: 12, w: 6, h: 4 },
    isVisible: true,
  },
];

const PERIOD_OPTIONS = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "7 Days" },
  { value: "30D", label: "30 Days" },
  { value: "90D", label: "90 Days" },
  { value: "YTD", label: "YTD" },
  { value: "CUSTOM", label: "Custom" },
];

function DashboardOverviewContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Profile and Workspace State
  const [user, setUser] = useState<LoginUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  // Filter States initialized from URL search params
  const [period, setPeriod] = useState<DashboardPeriod>(
    (searchParams?.get("period") as DashboardPeriod) || "30D"
  );
  const [fromDate, setFromDate] = useState<string>(
    searchParams?.get("from") || ""
  );
  const [toDate, setToDate] = useState<string>(searchParams?.get("to") || "");
  const [branchId, setBranchId] = useState<string>(
    searchParams?.get("branch_id") || ""
  );
  const [departmentId, setDepartmentId] = useState<string>(
    searchParams?.get("department_id") || ""
  );

  // Dropdown options
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

  // Summary Data State
  const [summaryData, setSummaryData] = useState<Record<string, unknown> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isWarmingUpServer, setIsWarmingUpServer] = useState<boolean>(false);

  // Show helpful hint if backend cold start takes longer than 4s
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => {
        setIsWarmingUpServer(true);
      }, 4000);
    } else {
      setIsWarmingUpServer(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Widget Layout Customization State
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [layoutNotice, setLayoutNotice] = useState<string | null>(null);

  // Sync URL search params
  const updateUrlParams = useCallback(
    (newParams: {
      period?: string;
      from?: string;
      to?: string;
      branch_id?: string;
      department_id?: string;
    }) => {
      const sp = new URLSearchParams(searchParams ? searchParams.toString() : "");
      Object.entries(newParams).forEach(([k, v]) => {
        if (v && v.trim()) {
          sp.set(k, v.trim());
        } else {
          sp.delete(k);
        }
      });
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Fetch initial profile & filters
  useEffect(() => {
    // 1. Load initial user and tenant from storage for fast hydration
    const initialUser = getUser();
    if (initialUser) setUser(initialUser);
    const initialTenant = getTenant();
    if (initialTenant) setTenant(initialTenant);

    // 2. Fetch fresh user profile
    getMe()
      .then((freshUser) => setUser(freshUser))
      .catch((err) => console.warn("Failed to refresh user profile:", err));

    // 3. Fetch branches and departments for filters
    getBranches().then(setBranches).catch(() => {});
    getDepartments().then(setDepartments).catch(() => {});

    // 4. Fetch custom widgets layout
    getDashboardWidgets("default")
      .then((savedWidgets) => {
        if (savedWidgets && savedWidgets.length > 0) {
          setWidgets(savedWidgets);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Summary Data
  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Validate custom dates if set
    if (period === "CUSTOM" && fromDate && toDate && fromDate > toDate) {
      setError("The 'From' date must be earlier than or equal to 'To' date.");
      setIsLoading(false);
      return;
    }

    try {
      const data = await getDashboardSummary({
        period,
        from: period === "CUSTOM" ? fromDate : undefined,
        to: period === "CUSTOM" ? toDate : undefined,
        branch_id: branchId || undefined,
        department_id: departmentId || undefined,
      });
      setSummaryData(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard summary.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [period, fromDate, toDate, branchId, departmentId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Handle Filter Form Changes
  const handlePeriodChange = (val: string) => {
    const p = val as DashboardPeriod;
    setPeriod(p);
    updateUrlParams({ period: p });
  };

  const handleApplyFilters = () => {
    updateUrlParams({
      period,
      from: fromDate,
      to: toDate,
      branch_id: branchId,
      department_id: departmentId,
    });
    fetchSummary();
  };

  const handleResetFilters = () => {
    setPeriod("30D");
    setFromDate("");
    setToDate("");
    setBranchId("");
    setDepartmentId("");
    updateUrlParams({
      period: "30D",
      from: "",
      to: "",
      branch_id: "",
      department_id: "",
    });
  };

  // Widget Customization Handlers
  const handleToggleWidget = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.widgetId === widgetId ? { ...w, isVisible: !w.isVisible } : w
      )
    );
  };

  const handleMoveWidget = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;
    const newWidgets = [...widgets];
    const [moved] = newWidgets.splice(index, 1);
    newWidgets.splice(targetIndex, 0, moved);
    setWidgets(newWidgets);
  };

  const handleSaveLayout = async () => {
    setIsSavingLayout(true);
    setLayoutNotice(null);
    try {
      await saveDashboardWidgets({
        layoutName: "default",
        widgets,
      });
      setLayoutNotice("Dashboard layout saved successfully!");
      setTimeout(() => {
        setIsCustomizing(false);
        setLayoutNotice(null);
      }, 1200);
    } catch {
      setLayoutNotice("Failed to persist layout to server, applied locally.");
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleResetLayoutToDefault = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  // Safe user formatting
  const fullName = user?.fullName || "Business Leader";
  const userRoles = user?.roles && user.roles.length > 0 ? user.roles : ["MEMBER"];
  const defaultCurrency = tenant?.defaultCurrency || "INR";

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* 1. Welcome Hero Banner */}
      <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Executive Command Center</span>
              </span>
              {tenant?.status && <StatusBadge status={tenant.status} />}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, {fullName}!
            </h2>

            <div className="flex items-center gap-4 text-xs text-indigo-200/80 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                {tenant?.name || "Enterprise Workspace"}
              </span>
              {tenant?.slug && (
                <span className="font-mono text-[11px] text-slate-300">
                  {tenant.slug}.bizflow.app
                </span>
              )}
              {tenant?.timezone && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Clock className="h-3 w-3" />
                  {tenant.timezone}
                </span>
              )}
            </div>
          </div>

          {/* User Profile Mini Card */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-3.5 lg:self-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-base shadow-sm">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs space-y-0.5">
              <span className="block font-bold text-white text-sm truncate max-w-[150px]">
                {fullName}
              </span>
              <span className="block text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                {user?.email || "No email"}
              </span>
              <div className="flex flex-wrap gap-1 pt-1">
                {userRoles.map((role) => (
                  <StatusBadge key={role} status={role} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions Row */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Quick Actions
          </span>
          <span className="text-[11px] text-slate-400">
            Frequently used operations
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link href="/dashboard/crm/leads">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all text-xs font-semibold text-slate-800 hover:text-indigo-700 group">
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                <Plus className="h-4 w-4" />
              </div>
              <span>New Lead</span>
            </div>
          </Link>

          <Link href="/dashboard/sales/quotations">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all text-xs font-semibold text-slate-800 hover:text-indigo-700 group">
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                <FileText className="h-4 w-4" />
              </div>
              <span>New Quotation</span>
            </div>
          </Link>

          <Link href="/dashboard/finance/expenses">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all text-xs font-semibold text-slate-800 hover:text-indigo-700 group">
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                <CreditCard className="h-4 w-4" />
              </div>
              <span>New Expense</span>
            </div>
          </Link>

          <Link href="/dashboard/tasks">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all text-xs font-semibold text-slate-800 hover:text-indigo-700 group">
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                <CheckSquare className="h-4 w-4" />
              </div>
              <span>New Task</span>
            </div>
          </Link>

          <Link href="/dashboard/team">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all text-xs font-semibold text-slate-800 hover:text-indigo-700 group">
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                <Users className="h-4 w-4" />
              </div>
              <span>Invite Member</span>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Global Filters Bar */}
      <DashboardFilterBar
        period={period}
        onPeriodChange={handlePeriodChange}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        branchId={branchId}
        onBranchIdChange={setBranchId}
        departmentId={departmentId}
        onDepartmentIdChange={setDepartmentId}
        branches={branches}
        departments={departments}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isLoading={isLoading}
        extraActions={
          <Button
            size="sm"
            variant={isCustomizing ? "secondary" : "outline"}
            onClick={() => setIsCustomizing((prev) => !prev)}
            leftIcon={<Sliders className="h-3.5 w-3.5" />}
            className="text-xs"
          >
            {isCustomizing ? "Exit Customization" : "Customize Layout"}
          </Button>
        }
      />

      {/* Customize Layout Toolbar */}
      {isCustomizing && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-600" />
                Customize Dashboard Widgets
              </h4>
              <p className="text-xs text-indigo-800/80 mt-0.5">
                Toggle visibility and reorder dashboard widgets to match your executive workflow.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetLayoutToDefault}
                className="text-xs"
              >
                Reset to Default
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleSaveLayout}
                isLoading={isSavingLayout}
                className="text-xs"
              >
                Save Layout
              </Button>
            </div>
          </div>

          {layoutNotice && (
            <div className="rounded-lg bg-emerald-100 border border-emerald-200 p-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{layoutNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {widgets.map((widget, idx) => (
              <div
                key={widget.widgetId}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-indigo-100 shadow-2xs text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleWidget(widget.widgetId)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      widget.isVisible
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-400"
                    )}
                    title={widget.isVisible ? "Hide widget" : "Show widget"}
                  >
                    {widget.isVisible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <span
                    className={cn(
                      "font-semibold truncate",
                      widget.isVisible ? "text-slate-900" : "text-slate-400 line-through"
                    )}
                  >
                    {widget.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveWidget(idx, "up")}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    title="Move up"
                  >
                    <MoveUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === widgets.length - 1}
                    onClick={() => handleMoveWidget(idx, "down")}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    title="Move down"
                  >
                    <MoveDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {error && !isLoading && (
        <ErrorState
          title="Dashboard Summary Unavailable"
          message={error}
          onRetry={fetchSummary}
        />
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-6 animate-pulse">
          {isWarmingUpServer && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50/90 border border-amber-200 p-4 text-xs text-amber-900 shadow-sm animate-fadeIn">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Backend server wake-up in progress...</p>
                <p className="text-amber-700 mt-0.5 text-[11px]">
                  Render free tier instances sleep after inactivity and take ~45–60 seconds on initial cold start. Your dashboard will automatically load as soon as the server responds!
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 rounded-2xl bg-slate-200" />
            <div className="h-72 rounded-2xl bg-slate-200" />
          </div>
        </div>
      )}

      {/* Render Dynamic Widgets Grid */}
      {!isLoading && (
        <div className="space-y-6">
          {widgets
            .filter((w) => w.isVisible !== false)
            .map((widget) => {
              switch (widget.type) {
                case "REVENUE_KPI":
                  return (
                    <RevenueKpiWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                      currency={defaultCurrency}
                    />
                  );
                case "PIPELINE":
                  return (
                    <PipelineWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                      currency={defaultCurrency}
                    />
                  );
                case "DUE_INVOICES":
                  return (
                    <DueInvoicesWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                      currency={defaultCurrency}
                    />
                  );
                case "EXPENSES":
                  return (
                    <ExpensesWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                      currency={defaultCurrency}
                    />
                  );
                case "TASKS":
                  return (
                    <TasksWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                    />
                  );
                case "ORG_COUNTS":
                  return (
                    <OrgCountsWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                    />
                  );
                case "RECENT_ACTIVITY":
                  return (
                    <RecentActivityWidget
                      key={widget.widgetId}
                      title={widget.title}
                      data={summaryData}
                    />
                  );
                default:
                  return null;
              }
            })}
        </div>
      )}

      {/* Dev-only Raw Response Inspector */}
      {process.env.NODE_ENV !== "production" && summaryData && (
        <div className="pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
              DEV MODE
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Inspect Raw Summary API Response
            </span>
          </div>
          <JsonViewer
            data={summaryData}
            title="GET /api/v1/dashboard/summary Response Body"
            defaultExpanded={false}
          />
        </div>
      )}
    </div>
  );
}

// Widget Sub-components

function RevenueKpiWidget({
  title,
  data,
  currency,
}: {
  title: string;
  data: Record<string, unknown> | null;
  currency: string;
}) {
  const totalRevenue =
    Number(data?.totalRevenue ?? data?.total_revenue ?? data?.revenue ?? 0);
  const mrr = Number(data?.mrr ?? data?.monthlyRecurringRevenue ?? 0);
  const arr = Number(data?.arr ?? data?.annualRecurringRevenue ?? mrr * 12);
  const growthRate = Number(
    data?.growthRate ?? data?.growth_rate ?? data?.growth ?? 0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {title}
          </h3>
        </div>

        <Link
          href="/dashboard/analytics"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Analytics</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 space-y-1">
          <span className="text-xs text-slate-500 font-medium">
            Total Revenue
          </span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={totalRevenue} currency={currency} />
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">
            Current reporting period
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 space-y-1">
          <span className="text-xs text-slate-500 font-medium">
            Monthly Run Rate (MRR)
          </span>
          <div className="text-xl font-black text-indigo-600">
            <MoneyText amount={mrr} currency={currency} />
          </div>
          <span className="text-[11px] text-slate-400 block">
            Normalized monthly revenue
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 space-y-1">
          <span className="text-xs text-slate-500 font-medium">
            Annual Run Rate (ARR)
          </span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={arr} currency={currency} />
          </div>
          <span className="text-[11px] text-slate-400 block">
            Annualized projection
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 space-y-1">
          <span className="text-xs text-slate-500 font-medium">
            Period Growth Rate
          </span>
          <div className="text-xl font-black text-slate-900">
            {growthRate > 0 ? `+${growthRate.toFixed(1)}%` : `${growthRate.toFixed(1)}%`}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Compared to previous cycle
          </span>
        </div>
      </div>
    </div>
  );
}

function PipelineWidget({
  title,
  data,
  currency,
}: {
  title: string;
  data: Record<string, unknown> | null;
  currency: string;
}) {
  const pipelineValue = Number(
    data?.pipelineValue ?? data?.pipeline_value ?? data?.totalPipeline ?? 0
  );
  const leadsCount = Number(
    data?.leadsCount ?? data?.leads_count ?? data?.totalLeads ?? 0
  );
  const wonCount = Number(
    data?.wonLeadsCount ?? data?.won_count ?? data?.wonDeals ?? 0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Coins className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>

        <Link
          href="/dashboard/crm/pipeline"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Pipeline Board</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Pipeline Value</span>
          <span className="text-base font-bold text-slate-900 block mt-0.5">
            <MoneyText amount={pipelineValue} currency={currency} />
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Active Leads</span>
          <span className="text-base font-bold text-indigo-600 block mt-0.5">
            {leadsCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Deals Won</span>
          <span className="text-base font-bold text-emerald-600 block mt-0.5">
            {wonCount}
          </span>
        </div>
      </div>
    </div>
  );
}

function DueInvoicesWidget({
  title,
  data,
  currency,
}: {
  title: string;
  data: Record<string, unknown> | null;
  currency: string;
}) {
  const dueAmount = Number(
    data?.dueInvoicesAmount ??
      data?.due_invoices_amount ??
      data?.overdueAmount ??
      0
  );
  const dueCount = Number(
    data?.dueInvoicesCount ?? data?.due_invoices_count ?? data?.dueCount ?? 0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Receipt className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>

        <Link
          href="/dashboard/sales/invoices"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>All Invoices</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50/50 border border-amber-100">
        <div>
          <span className="text-xs text-amber-900/80 font-medium block">
            Outstanding Amount Due
          </span>
          <div className="text-xl font-black text-amber-950 mt-0.5">
            <MoneyText amount={dueAmount} currency={currency} />
          </div>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
            {dueCount} Pending
          </span>
        </div>
      </div>
    </div>
  );
}

function ExpensesWidget({
  title,
  data,
  currency,
}: {
  title: string;
  data: Record<string, unknown> | null;
  currency: string;
}) {
  const totalExpenses = Number(
    data?.totalExpenses ?? data?.total_expenses ?? data?.expenses ?? 0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <CreditCard className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>

        <Link
          href="/dashboard/finance/expenses"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Expenses</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-100">
        <span className="text-xs text-rose-800/80 font-medium block">
          Operating Expenditure
        </span>
        <div className="text-xl font-black text-rose-950 mt-0.5">
          <MoneyText amount={totalExpenses} currency={currency} />
        </div>
      </div>
    </div>
  );
}

function TasksWidget({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null;
}) {
  const pendingTasks = Number(
    data?.pendingTasksCount ?? data?.pending_tasks ?? data?.todoTasks ?? 0
  );
  const completedTasks = Number(
    data?.completedTasksCount ?? data?.completed_tasks ?? data?.doneTasks ?? 0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckSquare className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>

        <Link
          href="/dashboard/tasks"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Task Board</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3.5 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Pending</span>
          <span className="text-lg font-bold text-amber-600 block mt-0.5">
            {pendingTasks}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Completed</span>
          <span className="text-lg font-bold text-emerald-600 block mt-0.5">
            {completedTasks}
          </span>
        </div>
      </div>
    </div>
  );
}

function OrgCountsWidget({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null;
}) {
  const members = Number(data?.membersCount ?? data?.totalUsers ?? 0);
  const branches = Number(data?.branchesCount ?? data?.totalBranches ?? 0);
  const departments = Number(data?.departmentsCount ?? data?.totalDepartments ?? 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>

        <Link
          href="/dashboard/team"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Manage Team</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
        <div className="p-3 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Team</span>
          <span className="text-base font-bold text-slate-900 mt-0.5 block">
            {members}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Branches</span>
          <span className="text-base font-bold text-slate-900 mt-0.5 block">
            {branches}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-400 block">Departments</span>
          <span className="text-base font-bold text-slate-900 mt-0.5 block">
            {departments}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentActivityWidget({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null;
}) {
  const activities = (data?.recentActivity ||
    data?.recent_activity ||
    data?.activities ||
    []) as Array<Record<string, unknown>>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
      </div>

      {Array.isArray(activities) && activities.length > 0 ? (
        <div className="space-y-3">
          {activities.slice(0, 5).map((act, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-800 truncate">
                  {String(act.title || act.action || act.description || "Activity logged")}
                </span>
              </div>
              <span className="text-slate-400 text-[11px] shrink-0">
                {String(act.createdAt || act.created_at || "Recent")}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50/60 rounded-xl">
          No recent activity logs recorded for this period.
        </div>
      )}
    </div>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse max-w-7xl mx-auto">
          <div className="h-32 bg-slate-200 rounded-3xl" />
          <div className="h-24 bg-slate-200 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <DashboardOverviewContent />
    </Suspense>
  );
}
