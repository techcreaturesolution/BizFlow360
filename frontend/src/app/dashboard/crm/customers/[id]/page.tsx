"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Building2,
  Hash,
  Mail,
  Phone,
  CreditCard,
  FileCheck,
  Calendar,
  FileText,
  Receipt,
  ArrowRight,
  ShieldCheck,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { getCustomerDetail } from "@/lib/crm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModuleLockedState } from "@/components/dashboard/ModuleLockedState";
import { JsonViewer } from "@/components/ui/JsonViewer";
import type { CustomerItem } from "@/types/crm";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getCustomerDetail(customerId);
      setCustomer(res.customer);
      setRawResponse(res.raw);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosErr.response?.status;
      const message = axiosErr.response?.data?.message || "Failed to load customer profile.";
      setError({ status, message });
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  // 403 Module Entitlement check
  if (error?.status === 403 || error?.message.toLowerCase().includes("not enabled")) {
    return <ModuleLockedState moduleName="CRM" message={error.message} />;
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8">
        <ErrorState
          title="Customer not found"
          message={error?.message || "Unable to locate this customer record."}
          onRetry={loadCustomer}
        />
      </div>
    );
  }

  const billingAddr = customer.billingAddress as Record<string, string> | null;

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/dashboard/crm/customers" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Customer Accounts</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 line-clamp-1">{customer.name}</span>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {customer.name}
              </h1>
              <StatusBadge status={customer.customerType} />
              <StatusBadge status={customer.status} />
            </div>

            <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-1">
              <Hash className="h-3.5 w-3.5 text-slate-400" />
              <span>Customer ID: {customer.customerCode}</span>
            </div>
          </div>

          {/* Quick Sales Action Shortcuts */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/dashboard/sales/quotations/new?customerId=${customer.id}`}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="h-3.5 w-3.5 text-indigo-600" />}
              >
                New Quotation
              </Button>
            </Link>

            <Link href={`/dashboard/sales/invoices/new?customerId=${customer.id}`}>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Receipt className="h-3.5 w-3.5" />}
                className="shadow-sm shadow-indigo-600/20"
              >
                New Invoice
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2-Column Profile Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Card 1: Contact & Registration Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span>Organization & Legal Profile</span>
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Legal Business Name</span>
              <span className="font-bold text-slate-900">{customer.name}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Account Code</span>
              <span className="font-mono font-bold text-slate-800">{customer.customerCode}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Account Classification</span>
              <StatusBadge status={customer.customerType} />
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Tax Identification / GSTIN</span>
              <span className="font-mono text-slate-800">{customer.taxId || "Not Registered"}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Billing Email</span>
              <span className="text-slate-800 font-medium">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-indigo-600 hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  "None listed"
                )}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Phone Contact</span>
              <span className="text-slate-800 font-medium">
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="text-slate-800 hover:underline">
                    {customer.phone}
                  </a>
                ) : (
                  "None listed"
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Commercial & Financial Terms */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <span>Commercial & Credit Terms</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
              <span className="text-slate-400 font-medium block">Approved Credit Limit</span>
              <span className="text-lg font-black text-slate-900 mt-1 block">
                <MoneyText amount={customer.creditLimit} currency={customer.currency || "INR"} />
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
              <span className="text-slate-400 font-medium block">Net Payment Terms</span>
              <span className="text-lg font-black text-slate-900 mt-1 block">
                {customer.paymentTermsDays} <span className="text-xs font-normal text-slate-500">days net</span>
              </span>
            </div>
          </div>

          {/* Billing Address Card */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>Registered Billing Address</span>
            </span>

            {billingAddr && Object.keys(billingAddr).length > 0 ? (
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-700 space-y-0.5">
                {billingAddr.line1 && <p>{billingAddr.line1}</p>}
                {billingAddr.line2 && <p>{billingAddr.line2}</p>}
                <p>
                  {[billingAddr.city, billingAddr.state, billingAddr.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {billingAddr.country && <p className="font-semibold">{billingAddr.country}</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                No billing address recorded for this client.
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Customer created: {new Date(customer.createdAt).toLocaleDateString()}</span>
            <span>Billing Currency: {customer.currency || "INR"}</span>
          </div>
        </div>
      </div>

      {/* Dev-only raw response */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-400">Customer Detail • BizFlow360 CRM Engine</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-slate-500"
        >
          {showRaw ? "Hide Raw Response" : "Dev: Raw Response"}
        </Button>
      </div>

      {showRaw && Boolean(rawResponse) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4">
          <JsonViewer data={rawResponse} title={`GET /api/v1/crm/customers/${customer.id} Raw Payload`} />
        </div>
      )}
    </div>
  );
}
