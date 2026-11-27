"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Hash,
  CreditCard,
  FileCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import { getCustomers } from "@/lib/crm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/ErrorState";
import { ModuleLockedState } from "@/components/dashboard/ModuleLockedState";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { CreateCustomerModal } from "@/components/crm/CreateCustomerModal";
import type {
  CustomerItem,
  CustomerType,
  CustomerStatus,
  NormalizedPagination,
} from "@/types/crm";

const TYPE_FILTER_OPTIONS = [
  { value: "ALL", label: "All Account Types" },
  { value: "B2B", label: "B2B Accounts" },
  { value: "B2C", label: "B2C Consumers" },
  { value: "ENTERPRISE", label: "Enterprise Clients" },
  { value: "PARTNER", label: "Channel Partners" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Account Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export default function CustomersDirectoryPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [pagination, setPagination] = useState<NormalizedPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "ALL">("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Debounce search 400ms
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  // Fetch customers
  const fetchCustomers = useCallback(
    async (pageToLoad = pagination.page) => {
      setLoading(true);
      setError(null);

      try {
        const res = await getCustomers({
          customerType: typeFilter !== "ALL" ? typeFilter : undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          search: debouncedSearch.trim() || undefined,
          page: pageToLoad,
          limit: pagination.limit,
        });

        setCustomers(res.customers);
        setPagination(res.pagination);
        setRawResponse(res.raw);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
        const status = axiosErr.response?.status;
        const message = axiosErr.response?.data?.message || "Failed to load customers.";
        setError({ status, message });
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, typeFilter, statusFilter, debouncedSearch]
  );

  useEffect(() => {
    fetchCustomers(pagination.page);
  }, [fetchCustomers, pagination.page]);

  // 403 Module Entitlement check
  if (error?.status === 403 || error?.message.toLowerCase().includes("not enabled")) {
    return <ModuleLockedState moduleName="CRM" message={error.message} />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <Building2 className="h-4 w-4" />
            <span>CRM & Deal Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Customer Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client profiles, invoicing terms, credit limits, and commercial engagements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateOpen(true)}
            className="shadow-sm shadow-indigo-600/20"
          >
            Create Customer
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or email..."
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as CustomerType | "ALL");
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              options={TYPE_FILTER_OPTIONS}
            />
          </div>

          <div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as CustomerStatus | "ALL");
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>

        {(typeFilter !== "ALL" || statusFilter !== "ALL" || search) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Showing filtered customer records ({pagination.total} matching)</span>
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("ALL");
                setStatusFilter("ALL");
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Customers Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="p-6">
            <ErrorState
              title="Failed to load customers"
              message={error.message}
              onRetry={() => fetchCustomers(1)}
            />
          </div>
        ) : loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title="No customer accounts found"
              description="No existing client or commercial accounts match your active filters. Create your first customer or convert a qualified CRM lead."
              actionLabel="Create Customer"
              onAction={() => setIsCreateOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Customer Organization</th>
                  <th className="py-3.5 px-4">Account Type</th>
                  <th className="py-3.5 px-4">Communication</th>
                  <th className="py-3.5 px-4">Tax ID / GSTIN</th>
                  <th className="py-3.5 px-4">Payment Terms</th>
                  <th className="py-3.5 px-4 text-right">Credit Limit</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Organization & Code */}
                    <td className="py-3.5 px-4">
                      <div>
                        <Link
                          href={`/dashboard/crm/customers/${cust.id}`}
                          className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors hover:underline text-xs"
                        >
                          {cust.name}
                        </Link>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Hash className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{cust.customerCode}</span>
                        </div>
                      </div>
                    </td>

                    {/* Classification Type */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={cust.customerType} />
                    </td>

                    {/* Contact info */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        {cust.email ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{cust.email}</span>
                          </div>
                        ) : null}
                        {cust.phone ? (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{cust.phone}</span>
                          </div>
                        ) : null}
                        {!cust.email && !cust.phone && (
                          <span className="text-slate-400 text-[11px]">No contact listed</span>
                        )}
                      </div>
                    </td>

                    {/* Tax ID */}
                    <td className="py-3.5 px-4 text-slate-700 font-mono text-[11px]">
                      {cust.taxId || "—"}
                    </td>

                    {/* Payment Terms */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-semibold">{cust.paymentTermsDays} days</span> net
                    </td>

                    {/* Credit Limit */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      <MoneyText amount={cust.creditLimit} currency={cust.currency || "INR"} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={cust.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/dashboard/crm/customers/${cust.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold transition-colors text-xs"
                      >
                        <span>Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        {!loading && customers.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing page <strong className="text-slate-800">{pagination.page}</strong> of{" "}
              <strong className="text-slate-800">{pagination.totalPages}</strong> ({pagination.total} total accounts)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev: NormalizedPagination) => ({ ...prev, page: prev.page - 1 }))}
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev: NormalizedPagination) => ({ ...prev, page: prev.page + 1 }))}
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dev-only raw toggle */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-400">Customers Table • BizFlow360 CRM Engine</span>
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
          <JsonViewer data={rawResponse} title="GET /api/v1/crm/customers Raw Payload" />
        </div>
      )}

      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          fetchCustomers(pagination.page);
        }}
      />
    </div>
  );
}
