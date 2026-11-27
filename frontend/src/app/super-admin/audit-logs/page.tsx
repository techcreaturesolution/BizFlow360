"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  Eye,
  User,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  ArrowRight,
} from "lucide-react";

import { getAuditLogs, parsePlatformError } from "@/lib/platform";
import type { AuditLogItem, PageMeta } from "@/types/platform";
import { TenantSelect } from "@/components/super-admin/TenantSelect";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function AuditLogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [meta, setMeta] = useState<PageMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters initialized from URL search params
  const [tenantFilter, setTenantFilter] = useState<string>(
    searchParams?.get("tenant_id") || ""
  );
  const [actionInput, setActionInput] = useState<string>(
    searchParams?.get("action") || ""
  );
  const [debouncedAction, setDebouncedAction] = useState<string>(
    searchParams?.get("action") || ""
  );
  const [entityTypeInput, setEntityTypeInput] = useState<string>(
    searchParams?.get("entity_type") || ""
  );
  const [actorUserIdInput, setActorUserIdInput] = useState<string>(
    searchParams?.get("actor_user_id") || ""
  );
  const [fromDate, setFromDate] = useState<string>(
    searchParams?.get("from") || ""
  );
  const [toDate, setToDate] = useState<string>(searchParams?.get("to") || "");
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams?.get("page") || "1", 10) || 1
  );
  const [pageSize, setPageSize] = useState<number>(20);

  // Debounce action input
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleActionChange = (val: string) => {
    setActionInput(val);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    actionTimeoutRef.current = setTimeout(() => {
      setDebouncedAction(val);
      setCurrentPage(1);
    }, 400);
  };

  // Keep URL in sync with filters
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (tenantFilter) params.set("tenant_id", tenantFilter);
    if (debouncedAction) params.set("action", debouncedAction);
    if (entityTypeInput) params.set("entity_type", entityTypeInput);
    if (actorUserIdInput) params.set("actor_user_id", actorUserIdInput);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (currentPage > 1) params.set("page", String(currentPage));

    const queryString = params.toString();
    router.replace(
      `/super-admin/audit-logs${queryString ? `?${queryString}` : ""}`,
      { scroll: false }
    );
  }, [
    tenantFilter,
    debouncedAction,
    entityTypeInput,
    actorUserIdInput,
    fromDate,
    toDate,
    currentPage,
    router,
  ]);

  const fetchAuditLogsList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getAuditLogs({
        tenant_id: tenantFilter || undefined,
        action: debouncedAction || undefined,
        entity_type: entityTypeInput || undefined,
        actor_user_id: actorUserIdInput || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setLogs(res.logs);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    tenantFilter,
    debouncedAction,
    entityTypeInput,
    actorUserIdInput,
    fromDate,
    toDate,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    updateUrlParams();
    fetchAuditLogsList();
  }, [updateUrlParams, fetchAuditLogsList]);

  const handleClearFilters = () => {
    setTenantFilter("");
    setActionInput("");
    setDebouncedAction("");
    setEntityTypeInput("");
    setActorUserIdInput("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    tenantFilter ||
      debouncedAction ||
      entityTypeInput ||
      actorUserIdInput ||
      fromDate ||
      toDate
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Audit Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, strictly read-only audit records of administrative operations, mutations, and config changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogsList}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <ErrorState
          title="Failed to load audit logs"
          message={error}
          onRetry={fetchAuditLogsList}
        />
      )}

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Filter by Organization
            </label>
            <TenantSelect
              value={tenantFilter}
              onChange={(val) => {
                setTenantFilter(val);
                setCurrentPage(1);
              }}
              label=""
              includeAllOption
              allLabel="All Organizations"
            />
          </div>

          <div>
            <Input
              label="Action Name"
              placeholder="e.g. TENANT_UPDATED"
              value={actionInput}
              onChange={(e) => handleActionChange(e.target.value)}
            />
          </div>

          <div>
            <Input
              label="Entity Type"
              placeholder="e.g. tenant, subscription"
              value={entityTypeInput}
              onChange={(e) => {
                setEntityTypeInput(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <Input
              label="Actor User ID"
              placeholder="User UUID..."
              value={actorUserIdInput}
              onChange={(e) => {
                setActorUserIdInput(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <Input
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <Input
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2 flex items-center justify-end gap-2 pt-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Audit Reason</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-36 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-7 w-14 bg-slate-200 rounded inline-block" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      title="No audit logs found"
                      description={
                        hasActiveFilters
                          ? "Try adjusting or clearing your filters to inspect historical logs."
                          : "No system audit events have been recorded yet."
                      }
                      actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                      onAction={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>

                    {/* Action Badge */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-tight">
                        {log.action}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-semibold text-slate-800 capitalize">
                        {log.entity_type}
                      </span>
                      {log.entity_id && (
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          #{log.entity_id.slice(0, 8)}
                        </div>
                      )}
                    </td>

                    {/* Organization */}
                    <td className="py-3.5 px-4 text-xs">
                      {log.tenant_name ? (
                        <span className="font-medium text-slate-900">
                          {log.tenant_name}
                        </span>
                      ) : log.tenant_id ? (
                        <span className="font-mono text-slate-500 text-[11px]">
                          {log.tenant_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-mono text-[11px]">
                          Platform
                        </span>
                      )}
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4">
                      {log.actor ? (
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">
                            {log.actor.full_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {log.actor.email}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>System / Webhook</span>
                        </span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                      <p className="truncate" title={log.reason || "No explicit reason logged"}>
                        {log.reason || <span className="text-slate-300">-</span>}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/super-admin/audit-logs/${log.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          rightIcon={<ArrowRight className="h-3 w-3" />}
                          className="text-xs"
                        >
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            <div>
              Showing page <span className="font-semibold text-slate-800">{meta.page}</span> of{" "}
              <span className="font-semibold text-slate-800">{meta.totalPages}</span> (
              {meta.total} total audit records)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= meta.totalPages || isLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-96 bg-slate-100 rounded-xl" />
        </div>
      }
    >
      <AuditLogsContent />
    </Suspense>
  );
}
