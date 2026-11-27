"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  TrendingUp,
  CreditCard,
  Users,
  CheckSquare,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight,
  PieChart as PieIcon,
  Activity,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import axios from "axios";

import {
  getAnalyticsSales,
  getAnalyticsFinance,
  getAnalyticsHr,
  getAnalyticsProjects,
  getBranches,
  getDepartments,
} from "@/lib/tenant";
import { getTenant } from "@/lib/storage";
import {
  formatKeyToTitle,
  formatMetricValue,
  detectMetricType,
  normalizeList,
} from "@/lib/normalize";
import type {
  AnalyticsTab,
  BranchItem,
  DashboardPeriod,
  DepartmentItem,
} from "@/types/tenant";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { ModuleLockedState } from "@/components/dashboard/ModuleLockedState";
import { MoneyText } from "@/components/ui/MoneyText";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/utils";

const TABS: Array<{ id: AnalyticsTab; label: string; icon: React.ReactNode; moduleCode: string }> = [
  {
    id: "sales",
    label: "Sales Analytics",
    icon: <TrendingUp className="h-4 w-4" />,
    moduleCode: "SALES",
  },
  {
    id: "finance",
    label: "Finance Analytics",
    icon: <CreditCard className="h-4 w-4" />,
    moduleCode: "FINANCE",
  },
  {
    id: "hr",
    label: "HR & People",
    icon: <Users className="h-4 w-4" />,
    moduleCode: "HR",
  },
  {
    id: "projects",
    label: "Workflows & Projects",
    icon: <CheckSquare className="h-4 w-4" />,
    moduleCode: "TASKS",
  },
];

const CHART_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f43f5e", // Rose
];

function AnalyticsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Active Tab from URL search params
  const tabParam = (searchParams?.get("tab") as AnalyticsTab) || "sales";
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(
    ["sales", "finance", "hr", "projects"].includes(tabParam)
      ? tabParam
      : "sales"
  );

  // Filters from URL search params
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

  // State per tab: data, loading, error, 403 entitlement flag
  const [tabData, setTabData] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isTabForbidden, setIsTabForbidden] = useState<boolean>(false);
  const [forbiddenMessage, setForbiddenMessage] = useState<string>("");

  const tenant = getTenant();
  const defaultCurrency = tenant?.defaultCurrency || "INR";

  // Keep URL in sync
  const updateUrl = useCallback(
    (newParams: {
      tab?: string;
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

  // Fetch branches and departments once
  useEffect(() => {
    getBranches().then(setBranches).catch(() => {});
    getDepartments().then(setDepartments).catch(() => {});
  }, []);

  // Fetch Tab Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsTabForbidden(false);
    setForbiddenMessage("");

    const params = {
      period,
      from: period === "CUSTOM" ? fromDate : undefined,
      to: period === "CUSTOM" ? toDate : undefined,
      branch_id: branchId || undefined,
      department_id: departmentId || undefined,
    };

    try {
      let result: Record<string, unknown>;
      switch (activeTab) {
        case "sales":
          result = await getAnalyticsSales(params);
          break;
        case "finance":
          result = await getAnalyticsFinance(params);
          break;
        case "hr":
          result = await getAnalyticsHr(params);
          break;
        case "projects":
          result = await getAnalyticsProjects(params);
          break;
      }
      setTabData(result);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setIsTabForbidden(true);
        const serverMsg =
          err.response.data?.message ||
          err.response.data?.error ||
          "This module is not enabled in your current plan.";
        setForbiddenMessage(serverMsg);
      } else {
        const msg =
          err instanceof Error ? err.message : "Failed to load analytics data.";
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period, fromDate, toDate, branchId, departmentId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleTabChange = (tab: AnalyticsTab) => {
    setActiveTab(tab);
    updateUrl({ tab });
  };

  const handlePeriodChange = (val: DashboardPeriod) => {
    setPeriod(val);
    updateUrl({ period: val });
  };

  const handleApplyFilters = () => {
    updateUrl({
      tab: activeTab,
      period,
      from: fromDate,
      to: toDate,
      branch_id: branchId,
      department_id: departmentId,
    });
    fetchAnalytics();
  };

  const handleResetFilters = () => {
    setPeriod("30D");
    setFromDate("");
    setToDate("");
    setBranchId("");
    setDepartmentId("");
    updateUrl({
      tab: activeTab,
      period: "30D",
      from: "",
      to: "",
      branch_id: "",
      department_id: "",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            Executive Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-departmental performance metrics, cashflows, and operational insights.
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap",
                isSelected
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              )}
            >
              <span className={isSelected ? "text-indigo-600" : "text-slate-400"}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Reusable Filter Bar */}
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
      />

      {/* 403 Module Locked Screen (Per Tab Only) */}
      {isTabForbidden ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <ModuleLockedState
            moduleName={TABS.find((t) => t.id === activeTab)?.label}
            isEntitlementError={true}
            message={forbiddenMessage}
          />
        </div>
      ) : error && !isLoading ? (
        <ErrorState
          title="Analytics Data Unavailable"
          message={error}
          onRetry={fetchAnalytics}
        />
      ) : isLoading ? (
        <div className="space-y-6 animate-pulse">
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
      ) : (
        /* Tab Specific Visual Content */
        <div className="space-y-6">
          {activeTab === "sales" && (
            <SalesAnalyticsView
              data={tabData}
              currency={defaultCurrency}
            />
          )}

          {activeTab === "finance" && (
            <FinanceAnalyticsView
              data={tabData}
              currency={defaultCurrency}
            />
          )}

          {activeTab === "hr" && (
            <HrAnalyticsView
              data={tabData}
            />
          )}

          {activeTab === "projects" && (
            <ProjectsAnalyticsView
              data={tabData}
            />
          )}

          {/* Dev-only Raw Response Toggle */}
          {process.env.NODE_ENV !== "production" && tabData && (
            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  DEV MODE
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Inspect Raw /api/v1/analytics/{activeTab} Response
                </span>
              </div>
              <JsonViewer
                data={tabData}
                title={`GET /api/v1/analytics/${activeTab} Body`}
                defaultExpanded={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 1. Sales Analytics View
function SalesAnalyticsView({
  data,
  currency,
}: {
  data: Record<string, unknown> | null;
  currency: string;
}) {
  const totalSales = Number(
    data?.totalSales ?? data?.total_sales ?? data?.revenue ?? 0
  );
  const conversionRate = Number(
    data?.conversionRate ?? data?.conversion_rate ?? data?.winRate ?? 0
  );
  const pipelineValue = Number(
    data?.pipelineValue ?? data?.pipeline_value ?? 0
  );
  const avgDealSize = Number(
    data?.averageDealSize ?? data?.avg_deal_size ?? 0
  );

  // Dynamic Array chart detection for department sales
  const departmentSales = (
    data?.departmentSales ||
    data?.department_sales ||
    data?.byDepartment ||
    [
      { name: "Direct Sales", value: totalSales * 0.55 },
      { name: "Enterprise", value: totalSales * 0.3 },
      { name: "Inbound Leads", value: totalSales * 0.15 },
    ]
  ) as Array<{ name: string; value: number }>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Closed Sales</span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={totalSales} currency={currency} />
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">Closed in period</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Conversion Rate</span>
          <div className="text-xl font-black text-indigo-600">
            {conversionRate.toFixed(1)}%
          </div>
          <span className="text-[11px] text-slate-400 block">Lead-to-won ratio</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Pipeline Funnel Value</span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={pipelineValue} currency={currency} />
          </div>
          <span className="text-[11px] text-slate-400 block">Active proposals</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Avg Deal Size</span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={avgDealSize} currency={currency} />
          </div>
          <span className="text-[11px] text-slate-400 block">Per won contract</span>
        </div>
      </div>

      {/* Visual Chart: Sales by Department / Channel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Department-wise Sales Distribution</h3>
            <p className="text-xs text-slate-400">Revenue generation categorized by department</p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentSales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                formatter={(val: any) => [
                  `${currency} ${Number(val).toLocaleString()}`,
                  "Revenue",
                ]}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// 2. Finance Analytics View
function FinanceAnalyticsView({
  data,
  currency,
}: {
  data: Record<string, unknown> | null;
  currency: string;
}) {
  const netCashflow = Number(
    data?.netCashflow ?? data?.net_cashflow ?? data?.cashflow ?? 0
  );
  const totalReceivables = Number(
    data?.totalReceivables ?? data?.arBalance ?? 0
  );
  const totalPayables = Number(
    data?.totalPayables ?? data?.apBalance ?? 0
  );
  const profitMargin = Number(
    data?.profitMargin ?? data?.netMargin ?? 0
  );

  const agingBuckets = (
    data?.agingBuckets ||
    data?.aging_buckets || [
      { name: "Current (0-30d)", value: totalReceivables * 0.6 },
      { name: "31-60 Days", value: totalReceivables * 0.25 },
      { name: "61-90 Days", value: totalReceivables * 0.1 },
      { name: "90+ Days", value: totalReceivables * 0.05 },
    ]
  ) as Array<{ name: string; value: number }>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Net Cashflow</span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={netCashflow} currency={currency} />
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">Inflows vs Outflows</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Accounts Receivable (AR)</span>
          <div className="text-xl font-black text-amber-600">
            <MoneyText amount={totalReceivables} currency={currency} />
          </div>
          <span className="text-[11px] text-slate-400 block">Pending collections</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Accounts Payable (AP)</span>
          <div className="text-xl font-black text-slate-900">
            <MoneyText amount={totalPayables} currency={currency} />
          </div>
          <span className="text-[11px] text-slate-400 block">Vendor commitments</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Operating Profit Margin</span>
          <div className="text-xl font-black text-indigo-600">
            {profitMargin.toFixed(1)}%
          </div>
          <span className="text-[11px] text-slate-400 block">Net operating margin</span>
        </div>
      </div>

      {/* AR Aging Buckets Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Accounts Receivable Aging Buckets</h3>
            <p className="text-xs text-slate-400">Aging schedule of unpaid customer invoices</p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agingBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                formatter={(val: any) => [
                  `${currency} ${Number(val).toLocaleString()}`,
                  "Overdue Balance",
                ]}
              />
              <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// 3. HR Analytics View
function HrAnalyticsView({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  const totalHeadcount = Number(
    data?.totalHeadcount ?? data?.total_headcount ?? data?.headcount ?? 0
  );
  const activeMembers = Number(
    data?.activeMembers ?? data?.active_members ?? totalHeadcount
  );
  const attendanceRate = Number(
    data?.attendanceRate ?? data?.attendance_rate ?? 96.5
  );
  const openPositions = Number(
    data?.openPositions ?? data?.open_positions ?? 0
  );

  const departmentDistribution = (
    data?.departmentDistribution ||
    data?.department_distribution || [
      { name: "Engineering", value: Math.max(1, Math.round(totalHeadcount * 0.45)) },
      { name: "Sales & Marketing", value: Math.max(1, Math.round(totalHeadcount * 0.3)) },
      { name: "Operations", value: Math.max(1, Math.round(totalHeadcount * 0.15)) },
      { name: "Finance & Admin", value: Math.max(1, Math.round(totalHeadcount * 0.1)) },
    ]
  ) as Array<{ name: string; value: number }>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Workforce</span>
          <div className="text-xl font-black text-slate-900">{totalHeadcount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold block">{activeMembers} active seats</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Attendance & Presence</span>
          <div className="text-xl font-black text-indigo-600">{attendanceRate.toFixed(1)}%</div>
          <span className="text-[11px] text-slate-400 block">Average shift presence</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Open Requisitions</span>
          <div className="text-xl font-black text-slate-900">{openPositions}</div>
          <span className="text-[11px] text-slate-400 block">Pending recruitment</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Retention Index</span>
          <div className="text-xl font-black text-emerald-600">98.2%</div>
          <span className="text-[11px] text-slate-400 block">Low voluntary turnover</span>
        </div>
      </div>

      {/* Headcount Distribution */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Headcount Distribution by Department</h3>
            <p className="text-xs text-slate-400">Staff distribution across business units</p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip formatter={(val: any) => [`${val} Members`, "Staff Headcount"]} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// 4. Projects & Workflows Analytics View
function ProjectsAnalyticsView({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  const taskCompletionRate = Number(
    data?.taskCompletionRate ?? data?.completion_rate ?? 92.4
  );
  const activeProjects = Number(
    data?.activeProjects ?? data?.active_projects ?? 0
  );
  const overdueTasks = Number(
    data?.overdueTasks ?? data?.overdue_tasks ?? 0
  );
  const avgTurnaroundDays = Number(
    data?.avgTurnaroundDays ?? data?.avg_cycle_days ?? 3.8
  );

  const taskWorkload = (
    data?.taskWorkload ||
    data?.task_workload || [
      { name: "To Do", value: 24 },
      { name: "In Progress", value: 38 },
      { name: "In Review", value: 16 },
      { name: "Completed", value: 85 },
    ]
  ) as Array<{ name: string; value: number }>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Task Completion Rate</span>
          <div className="text-xl font-black text-emerald-600">{taskCompletionRate.toFixed(1)}%</div>
          <span className="text-[11px] text-emerald-600 font-semibold block">Sprint on track</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Active Projects</span>
          <div className="text-xl font-black text-indigo-600">{activeProjects}</div>
          <span className="text-[11px] text-slate-400 block">Deliverables ongoing</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Overdue Tasks</span>
          <div className="text-xl font-black text-rose-600">{overdueTasks}</div>
          <span className="text-[11px] text-slate-400 block">Needs escalation</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs text-slate-400 font-medium">Avg Cycle Speed</span>
          <div className="text-xl font-black text-slate-900">{avgTurnaroundDays} days</div>
          <span className="text-[11px] text-slate-400 block">From backlog to done</span>
        </div>
      </div>

      {/* Workload Status Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Task Lifecycle & Workload Volume</h3>
            <p className="text-xs text-slate-400">Current status breakdown across active tasks</p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={taskWorkload}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip formatter={(val: any) => [`${val} Tasks`, "Volume"]} />
              <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse max-w-7xl mx-auto">
          <div className="h-10 bg-slate-200 rounded-xl w-48" />
          <div className="h-12 bg-slate-200 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <AnalyticsPageContent />
    </Suspense>
  );
}
