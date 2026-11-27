"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  CreditCard,
  Building,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Clock,
  ShieldCheck,
} from "lucide-react";

import { getInvoice, parsePlatformError } from "@/lib/platform";
import type { InvoiceDetail } from "@/types/platform";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { MoneyText } from "@/components/super-admin/MoneyText";
import { JsonViewer } from "@/components/super-admin/JsonViewer";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Button } from "@/components/ui/Button";

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

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInvoiceDetail = useCallback(async () => {
    if (!invoiceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getInvoice(invoiceId);
      setInvoice(data);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoiceDetail();
  }, [fetchInvoiceDetail]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-10 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-44 bg-slate-200 rounded-xl md:col-span-2" />
          <div className="h-44 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/super-admin/invoices")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Invoices
        </Button>
        <ErrorState
          title="Invoice Not Found"
          message={error || "The requested invoice could not be located."}
          onRetry={fetchInvoiceDetail}
        />
      </div>
    );
  }

  const payments = invoice.payments || [];

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          href="/super-admin/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                  {invoice.invoice_no}
                </h1>
                <StatusBadge status={invoice.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Issued for{" "}
                <Link
                  href={`/super-admin/tenants/${invoice.tenant_id}`}
                  className="font-semibold text-slate-700 hover:text-indigo-600 underline"
                >
                  {invoice.tenant_name || invoice.tenant_slug || "Organization"}
                </Link>{" "}
                on {formatDateTime(invoice.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoiceDetail}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Overview & Financial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Breakdown Card */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <span>Financial Breakdown</span>
          </h2>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 divide-y divide-slate-200">
            <div className="flex items-center justify-between pb-3 text-sm">
              <span className="text-slate-600">Subtotal Amount</span>
              <span className="font-semibold text-slate-900">
                <MoneyText amount={invoice.amount} currency={invoice.currency} />
              </span>
            </div>

            <div className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-600">Tax / GST (18%)</span>
              <span className="font-medium text-slate-700">
                <MoneyText amount={invoice.tax} currency={invoice.currency} />
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 text-base">
              <span className="font-bold text-slate-900">Total Due / Billed</span>
              <span className="font-extrabold text-indigo-600 text-xl">
                <MoneyText amount={invoice.total} currency={invoice.currency} />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Due Date</span>
              <span className="font-semibold text-slate-800">
                {formatDate(invoice.due_date)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Settlement Date</span>
              <span className="font-semibold text-slate-800">
                {invoice.paid_at ? formatDate(invoice.paid_at) : "Pending"}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Currency</span>
              <span className="font-semibold text-slate-800 uppercase">
                {invoice.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Association & Metadata Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Building className="h-4 w-4 text-indigo-600" />
            <span>Associated Details</span>
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Tenant Organization</span>
              <Link
                href={`/super-admin/tenants/${invoice.tenant_id}`}
                className="font-semibold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5"
              >
                <span>{invoice.tenant_name || "View Tenant"}</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </Link>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                ID: {invoice.tenant_id}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Subscription Reference</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-700 truncate max-w-[200px]" title={invoice.subscription_id}>
                  {invoice.subscription_id}
                </span>
                <button
                  onClick={() => copyToClipboard(invoice.subscription_id, "sub_id")}
                  className="text-slate-400 hover:text-slate-700"
                  title="Copy Subscription ID"
                >
                  {copiedId === "sub_id" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Invoice Record ID</span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <span className="truncate max-w-[200px]">{invoice.id}</span>
                <button
                  onClick={() => copyToClipboard(invoice.id, "inv_id")}
                  className="text-slate-400 hover:text-slate-700"
                  title="Copy Invoice ID"
                >
                  {copiedId === "inv_id" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[11px]">
              <span>Updated: {formatDateTime(invoice.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Payments Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Linked Payment Transactions ({payments.length})
            </h2>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No payments recorded"
              description="No gateway payment transactions have been logged for this invoice yet."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((pmt) => (
              <div key={pmt.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-xs text-slate-900 px-2 py-0.5 rounded bg-slate-100 uppercase tracking-wider">
                      {pmt.provider}
                    </span>
                    <span className="font-mono text-xs text-slate-600 font-medium">
                      {pmt.provider_payment_id || pmt.id}
                    </span>
                    <StatusBadge status={pmt.status} />
                  </div>

                  <div className="text-sm font-bold text-slate-900">
                    <MoneyText amount={pmt.amount} currency={pmt.currency} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Processed on {formatDateTime(pmt.created_at)}</span>
                  </div>
                </div>

                {pmt.raw_payload && (
                  <div className="pt-2">
                    <JsonViewer
                      data={pmt.raw_payload}
                      title={`Gateway Payload (${pmt.provider})`}
                      defaultExpanded={false}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
