"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Calendar,
} from "lucide-react";

import { getInvoices, parsePlatformError } from "@/lib/platform";
import type { InvoiceItem, PageMeta, InvoiceStatus } from "@/types/platform";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { MoneyText } from "@/components/super-admin/MoneyText";
import { TenantSelect } from "@/components/super-admin/TenantSelect";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Void" },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [meta, setMeta] = useState<PageMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchInvoicesList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getInvoices({
        tenant_id: tenantFilter || undefined,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setInvoices(res.invoices);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [tenantFilter, statusFilter, fromDate, toDate, currentPage, pageSize]);

  useEffect(() => {
    fetchInvoicesList();
  }, [fetchInvoicesList]);

  const handleClearFilters = () => {
    setTenantFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    tenantFilter || statusFilter || fromDate || toDate
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track tenant billing invoices, settlement status, and reconciliations across the platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvoicesList}
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
          title="Failed to load invoices"
          message={error}
          onRetry={fetchInvoicesList}
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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Filter by Status
            </label>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={STATUS_OPTIONS}
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
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Settlement</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 w-12 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-6 w-16 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-8 w-14 bg-slate-200 rounded inline-block" />
                    </td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8">
                    <EmptyState
                      title="No invoices found"
                      description={
                        hasActiveFilters
                          ? "Try adjusting your filters or date range to see invoices."
                          : "No billing invoices have been issued across the platform yet."
                      }
                      actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                      onAction={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Invoice Number */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/super-admin/invoices/${inv.id}`}
                        className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span>{inv.invoice_no}</span>
                      </Link>
                    </td>

                    {/* Organization */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/super-admin/tenants/${inv.tenant_id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 flex items-center gap-1 group/link"
                      >
                        <span className="truncate max-w-[160px]">
                          {inv.tenant_name || "Unknown"}
                        </span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                      </Link>
                      <div className="text-xs text-slate-400 font-mono">
                        {inv.tenant_slug ? `${inv.tenant_slug}` : ""}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      <MoneyText amount={inv.amount} currency={inv.currency} />
                    </td>

                    {/* Tax */}
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                      <MoneyText amount={inv.tax} currency={inv.currency} />
                    </td>

                    {/* Total */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      <MoneyText amount={inv.total} currency={inv.currency} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inv.status} />
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {formatDate(inv.due_date)}
                    </td>

                    {/* Paid Date */}
                    <td className="py-3.5 px-4 text-xs">
                      {inv.paid_at ? (
                        <span className="text-emerald-700 font-medium">
                          {formatDate(inv.paid_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/super-admin/invoices/${inv.id}`}>
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
              {meta.total} total invoices)
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
