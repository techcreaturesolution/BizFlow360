"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import {
  FileText,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  Layers,
  TrendingUp,
  Wallet,
  Users,
  CheckSquare,
  ShieldCheck,
  Building,
  Calendar,
  ExternalLink,
} from "lucide-react";

import {
  createReportExport,
  getReportExports,
} from "@/lib/tenant";
import {
  ReportType,
  ExportFormat,
  ExportJobItem,
  DashboardPeriod,
} from "@/types/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface ReportTypeOption {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

const REPORT_TYPE_OPTIONS: ReportTypeOption[] = [
  {
    type: "DASHBOARD_SUMMARY",
    title: "Executive Summary",
    description: "High-level overview of revenue, active pipeline, invoices, and employee headcounts.",
    icon: Sparkles,
    tag: "Overview",
  },
  {
    type: "SALES",
    title: "Sales & CRM Deals",
    description: "Detailed deal pipeline, stage conversion rates, lead owners, and customer revenue.",
    icon: TrendingUp,
    tag: "Sales",
  },
  {
    type: "FINANCE",
    title: "Finance & Invoices",
    description: "Billed invoices, collected payments, overdue receivables, and itemized expenses.",
    icon: Wallet,
    tag: "Finance",
  },
  {
    type: "HR",
    title: "HR & Attendance",
    description: "Staff headcount, department distribution, check-in logs, and approved leaves.",
    icon: Users,
    tag: "HR",
  },
  {
    type: "PROJECTS",
    title: "Projects & Tasks",
    description: "Active sprint status, completed milestones, pending assignments, and deadlines.",
    icon: CheckSquare,
    tag: "Operations",
  },
  {
    type: "TEAM",
    title: "Team & Role Directory",
    description: "Full workspace user listing, branch assignments, role privileges, and contact info.",
    icon: Building,
    tag: "Admin",
  },
  {
    type: "AUDIT_LOGS",
    title: "Audit & Security Logs",
    description: "Chronological security events, user logins, credential updates, and workspace audits.",
    icon: ShieldCheck,
    tag: "Security",
  },
];

const FORMAT_OPTIONS = [
  { value: "CSV", label: "CSV (.csv)", icon: <FileText className="w-3.5 h-3.5" /> },
  { value: "XLSX", label: "Excel (.xlsx)", icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
  { value: "PDF", label: "PDF Document (.pdf)", icon: <FileText className="w-3.5 h-3.5" /> },
];

const PERIOD_OPTIONS: { value: DashboardPeriod | "ALL"; label: string }[] = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "Last 7 Days" },
  { value: "30D", label: "Last 30 Days" },
  { value: "90D", label: "Last 90 Days" },
  { value: "YTD", label: "Year to Date" },
  { value: "ALL", label: "All Time" },
];

function ReportsPageContent() {
  const [selectedType, setSelectedType] = useState<ReportType>("DASHBOARD_SUMMARY");
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("CSV");
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod | "ALL">("30D");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ExportJobItem[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [rawJobsData, setRawJobsData] = useState<unknown>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadJobs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    setJobsError(null);
    try {
      const items = await getReportExports();
      setJobs(items);
      setRawJobsData(items);
    } catch (err: unknown) {
      console.warn("Error loading export jobs:", err);
      setJobsError("Failed to fetch export history. Please click refresh.");
    } finally {
      setIsLoadingJobs(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Polling setup: check every 10s if any job is PENDING, QUEUED, or PROCESSING
  useEffect(() => {
    const hasActiveJobs = jobs.some((j) =>
      ["PENDING", "PROCESSING", "QUEUED"].includes(j.status?.toUpperCase() || "")
    );

    if (hasActiveJobs) {
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(() => {
          loadJobs(true);
        }, 10000);
      }
    } else if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [jobs, loadJobs]);

  const handleGenerateExport = async () => {
    setIsSubmitting(true);
    setSubmitSuccessMsg(null);
    setSubmitErrorMsg(null);

    try {
      const filterPayload: Record<string, unknown> = {};
      if (selectedPeriod !== "ALL") {
        filterPayload.period = selectedPeriod;
      }

      await createReportExport({
        reportType: selectedType,
        format: selectedFormat,
        filters: filterPayload,
      });

      setSubmitSuccessMsg(
        `Report export queued successfully as ${selectedFormat}. Processing usually completes in 10-30 seconds.`
      );

      // Refresh jobs list to display newly queued item
      await loadJobs(true);
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { message?: string; error?: string } } };
      if (errorObj?.response?.status === 403) {
        setSubmitErrorMsg(
          "Permission Denied: Your account role does not have the REPORTS.EXPORT.CREATE privilege."
        );
      } else {
        const msg =
          errorObj?.response?.data?.message ||
          errorObj?.response?.data?.error ||
          "Unable to queue report export. Please check your backend connection.";
        setSubmitErrorMsg(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getJobDownloadUrl = (job: ExportJobItem) => {
    return job.url || job.fileUrl || job.downloadUrl || null;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports & Exports
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles className="w-3 h-3" /> Export Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Generate asynchronous CSV, Excel, or PDF reports for your business, financial, and team operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadJobs()}
            disabled={isRefreshing}
            className="h-9 px-3 gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh Jobs</span>
          </Button>

          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs font-mono font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              {showRawJson ? "Hide Raw JSON" : "Raw JSON"}
            </button>
          )}
        </div>
      </div>

      {/* Dev Raw JSON Viewer */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/reports/export
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Count: {jobs.length} items
            </span>
          </div>
          <JsonViewer data={rawJobsData} defaultExpanded={true} />
        </div>
      )}

      {/* Section 1: Generate New Export */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Configure New Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the dataset, file format, and reporting timeframe to generate your customized export.
          </p>
        </div>

        {/* Step 1: Select Report Type */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            1. Select Report Category
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {REPORT_TYPE_OPTIONS.map((opt) => {
              const isSelected = selectedType === opt.type;
              const Icon = opt.icon;
              return (
                <div
                  key={opt.type}
                  onClick={() => setSelectedType(opt.type)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedType(opt.type);
                  }}
                  className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                      {opt.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {opt.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Format & Period Selection Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
          {/* Format Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              2. Export Format
            </label>
            <SegmentedControl
              options={FORMAT_OPTIONS}
              value={selectedFormat}
              onChange={(val) => setSelectedFormat(val as ExportFormat)}
              size="md"
              className="w-full justify-stretch"
            />
          </div>

          {/* Period Range Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              3. Filter Period
            </label>
            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              {PERIOD_OPTIONS.map((p) => {
                const isSelected = selectedPeriod === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSelectedPeriod(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      isSelected
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feedback messages */}
        {submitSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800">
              <p className="font-semibold text-emerald-900">Export Started</p>
              <p className="mt-0.5">{submitSuccessMsg}</p>
            </div>
          </div>
        )}

        {submitErrorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800">
              <p className="font-semibold text-rose-900">Export Failed</p>
              <p className="mt-0.5">{submitErrorMsg}</p>
            </div>
          </div>
        )}

        {/* Submit Action */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            Exporting as <span className="font-bold text-slate-800">{selectedFormat}</span> • Period:{" "}
            <span className="font-bold text-slate-800">{selectedPeriod}</span>
          </div>

          <Button
            onClick={handleGenerateExport}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Queueing Export...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generate Export</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Section 2: Recent Export Jobs History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Recent Export Jobs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              History of generated documents. Active tasks poll automatically every 10 seconds.
            </p>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {jobs.length} Total Jobs
          </span>
        </div>

        {jobsError && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>{jobsError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadJobs()}
              className="text-xs h-8 bg-white border-amber-300 text-amber-800 hover:bg-amber-100/50"
            >
              Retry
            </Button>
          </div>
        )}

        {isLoadingJobs ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-indigo-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No export jobs yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Select a report type above and click &quot;Generate Export&quot; to build your first spreadsheet or document.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Report Type</th>
                  <th className="py-3.5 px-6">Format</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Requested At</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {jobs.map((job) => {
                  const downloadUrl = getJobDownloadUrl(job);
                  const isFinished = ["COMPLETED", "SUCCEEDED"].includes(job.status?.toUpperCase() || "");
                  const isProcessing = ["PENDING", "PROCESSING", "QUEUED"].includes(job.status?.toUpperCase() || "");

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                            {job.format?.toUpperCase() === "XLSX" ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {job.reportType?.replace(/_/g, " ") || "Summary Report"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {job.id.slice(0, 12)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {job.format?.toUpperCase() || "CSV"}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <StatusBadge status={job.status} />
                      </td>

                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {job.createdAt
                          ? new Date(job.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Just now"}
                      </td>

                      <td className="py-4 px-6 text-right">
                        {isFinished && downloadUrl ? (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/70 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        ) : isProcessing ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Processing</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {job.status?.toUpperCase() === "FAILED" ? "Failed" : "Unavailable"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsLoadingSkeleton() {
  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoadingSkeleton />}>
      <ReportsPageContent />
    </Suspense>
  );
}
