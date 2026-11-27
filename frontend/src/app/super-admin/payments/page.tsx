"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard,
  RefreshCw,
  Search,
  Filter,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Code,
  AlertCircle,
} from "lucide-react";

import { getPayments, parsePlatformError } from "@/lib/platform";
import type { PaymentTransactionItem, PageMeta } from "@/types/platform";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { MoneyText } from "@/components/super-admin/MoneyText";
import { TenantSelect } from "@/components/super-admin/TenantSelect";
import { JsonViewer } from "@/components/super-admin/JsonViewer";
import { Modal } from "@/components/super-admin/Modal";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const PROVIDER_OPTIONS = [
  { value: "", label: "All Gateways" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "STRIPE", label: "Stripe" },
];

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
    });
  } catch {
    return dateStr;
  }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentTransactionItem[]>([]);
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
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Payload Modal
  const [payloadModalPayment, setPayloadModalPayment] = useState<PaymentTransactionItem | null>(null);

  const fetchPaymentsList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getPayments({
        tenant_id: tenantFilter || undefined,
        provider: providerFilter || undefined,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setPayments(res.payments);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [tenantFilter, providerFilter, statusFilter, fromDate, toDate, currentPage, pageSize]);

  useEffect(() => {
    fetchPaymentsList();
  }, [fetchPaymentsList]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearFilters = () => {
    setTenantFilter("");
    setProviderFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    tenantFilter || providerFilter || statusFilter || fromDate || toDate
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Payment Transactions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Read-only ledger of gateway payment events, webhook transactions, and settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPaymentsList}
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
          title="Failed to load payment transactions"
          message={error}
          onRetry={fetchPaymentsList}
        />
      )}

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
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
              Filter by Gateway
            </label>
            <Select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={PROVIDER_OPTIONS}
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

      {/* Payments Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Gateway Reference ID</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Linked Invoice</th>
                <th className="py-3 px-4">Processed Date</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-36 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 w-20 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-6 w-16 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-24 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-7 w-16 bg-slate-200 rounded inline-block" />
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8">
                    <EmptyState
                      title="No payment records found"
                      description={
                        hasActiveFilters
                          ? "Try adjusting your filters or date range to view payment events."
                          : "No payment transactions have been logged across the platform yet."
                      }
                      actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                      onAction={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </td>
                </tr>
              ) : (
                payments.map((pmt) => {
                  const isFailed = pmt.status === "FAILED";
                  return (
                    <tr
                      key={pmt.id}
                      className={`transition-colors group ${
                        isFailed
                          ? "bg-rose-50/40 hover:bg-rose-50/70"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Organization */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/super-admin/tenants/${pmt.tenant_id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600 flex items-center gap-1 group/link"
                        >
                          <span className="truncate max-w-[150px]">
                            {pmt.tenant_name || "Unknown Tenant"}
                          </span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                        </Link>
                        <div className="text-xs text-slate-400 font-mono">
                          ID: {pmt.tenant_id.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Gateway Provider */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 uppercase tracking-wider border border-slate-200">
                          {pmt.provider}
                        </span>
                      </td>

                      {/* Gateway Payment ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-xs font-semibold text-slate-800 truncate max-w-[180px]"
                            title={pmt.provider_payment_id || pmt.id}
                          >
                            {pmt.provider_payment_id || pmt.id}
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(pmt.provider_payment_id || pmt.id, pmt.id)
                            }
                            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                            title="Copy Payment ID"
                          >
                            {copiedId === pmt.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        <MoneyText amount={pmt.amount} currency={pmt.currency} />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={pmt.status} />
                      </td>

                      {/* Linked Invoice */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {pmt.invoice_id ? (
                          <Link
                            href={`/super-admin/invoices/${pmt.invoice_id}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View Invoice</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(pmt.created_at)}
                      </td>

                      {/* Action: View Payload */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPayloadModalPayment(pmt)}
                          leftIcon={<Code className="h-3.5 w-3.5 text-slate-500" />}
                          className="text-xs text-slate-600 hover:text-slate-900"
                        >
                          Payload
                        </Button>
                      </td>
                    </tr>
                  );
                })
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
              {meta.total} total transactions)
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

      {/* Raw Payload Modal */}
      <Modal
        isOpen={Boolean(payloadModalPayment)}
        onClose={() => setPayloadModalPayment(null)}
        title="Payment Event Payload"
        description="Inspect the raw webhook notification event received from the payment gateway."
        maxWidth="lg"
      >
        {payloadModalPayment && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-slate-400 block mb-0.5">Gateway</span>
                <span className="font-semibold text-slate-900 uppercase">
                  {payloadModalPayment.provider}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Status</span>
                <StatusBadge status={payloadModalPayment.status} />
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Amount</span>
                <span className="font-bold text-slate-900">
                  <MoneyText
                    amount={payloadModalPayment.amount}
                    currency={payloadModalPayment.currency}
                  />
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Timestamp</span>
                <span className="text-slate-700">
                  {formatDateTime(payloadModalPayment.created_at)}
                </span>
              </div>
            </div>

            <JsonViewer
              data={payloadModalPayment.raw_payload || { message: "No raw payload stored" }}
              title="Webhook Body JSON"
              defaultExpanded={true}
            />

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPayloadModalPayment(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
