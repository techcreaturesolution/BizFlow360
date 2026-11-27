"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  RefreshCw,
  Filter,
  Sliders,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

import {
  getSubscriptions,
  adjustSubscription,
  parsePlatformError,
} from "@/lib/platform";
import type {
  SubscriptionListItem,
  PageMeta,
  AdjustmentType,
} from "@/types/platform";
import {
  adjustSubscriptionSchema,
  type AdjustSubscriptionFormData,
} from "@/lib/validations";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { Modal } from "@/components/super-admin/Modal";
import { MoneyText } from "@/components/super-admin/MoneyText";
import { TenantSelect } from "@/components/super-admin/TenantSelect";
import { PlanSelect } from "@/components/super-admin/PlanSelect";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAST_DUE", label: "Past Due" },
  { value: "GRACE", label: "Grace Period" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

const ADJUSTMENT_OPTIONS = [
  { value: "EXTEND_TRIAL", label: "Extend Trial Period" },
  { value: "CHANGE_PLAN", label: "Change Plan" },
  { value: "MANUAL_ACTIVATE", label: "Manual Activate (Bypass Payment)" },
  { value: "MARK_INVOICE_PAID", label: "Mark Invoice as Paid" },
  { value: "SUSPEND", label: "Suspend Subscription" },
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

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([]);
  const [meta, setMeta] = useState<PageMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Adjust Modal
  const [selectedSub, setSelectedSub] = useState<SubscriptionListItem | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchSubscriptionsList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getSubscriptions({
        status: statusFilter || undefined,
        plan_id: planFilter || undefined,
        tenant_id: tenantFilter || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setSubscriptions(res.subscriptions);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, planFilter, tenantFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchSubscriptionsList();
  }, [fetchSubscriptionsList]);

  // Adjust Form
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustSubscriptionFormData>({
    resolver: zodResolver(adjustSubscriptionSchema),
    defaultValues: {
      adjustment_type: "EXTEND_TRIAL",
      reason: "",
      plan_id: "",
      trial_ends_at: "",
      invoice_id: "",
    },
  });

  const selectedAdjustmentType = watch("adjustment_type");

  const openAdjustModal = (sub: SubscriptionListItem) => {
    setSelectedSub(sub);
    setAdjustError(null);
    setAdjustSuccess(null);

    // Calculate default trial end 14 days from now if extending
    const defaultTrialDate = new Date();
    defaultTrialDate.setDate(defaultTrialDate.getDate() + 14);
    const dateFormatted = defaultTrialDate.toISOString().slice(0, 16);

    reset({
      adjustment_type: "EXTEND_TRIAL",
      reason: "",
      plan_id: sub.plan_id || "",
      trial_ends_at: dateFormatted,
      invoice_id: "",
    });
    setIsAdjustOpen(true);
  };

  const closeAdjustModal = () => {
    setIsAdjustOpen(false);
    setSelectedSub(null);
    setAdjustError(null);
  };

  const onAdjustSubmit = async (data: AdjustSubscriptionFormData) => {
    if (!selectedSub) return;
    setAdjustError(null);
    setAdjustSuccess(null);

    try {
      let isoTrialDate: string | undefined = undefined;
      if (data.adjustment_type === "EXTEND_TRIAL" && data.trial_ends_at) {
        isoTrialDate = new Date(data.trial_ends_at).toISOString();
      }

      await adjustSubscription(selectedSub.id, {
        adjustment_type: data.adjustment_type as AdjustmentType,
        reason: data.reason.trim(),
        plan_id: data.adjustment_type === "CHANGE_PLAN" ? data.plan_id?.trim() : undefined,
        trial_ends_at: isoTrialDate,
        invoice_id:
          data.adjustment_type === "MARK_INVOICE_PAID" ? data.invoice_id?.trim() : undefined,
      });

      setAdjustSuccess("Subscription adjusted successfully!");
      await fetchSubscriptionsList();
      setTimeout(() => {
        closeAdjustModal();
      }, 1200);
    } catch (err: unknown) {
      setAdjustError(parsePlatformError(err));
    }
  };

  const handleClearFilters = () => {
    setStatusFilter("");
    setPlanFilter("");
    setTenantFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(statusFilter || planFilter || tenantFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Subscriptions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor tenant subscription lifecycles, billing terms, and perform administrative adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSubscriptionsList}
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
          title="Failed to load subscriptions"
          message={error}
          onRetry={fetchSubscriptionsList}
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
              Filter by Plan
            </label>
            <PlanSelect
              value={planFilter}
              onChange={(val) => {
                setPlanFilter(val);
                setCurrentPage(1);
              }}
              label=""
              includeAllOption
              allLabel="All Plans"
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

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="md"
                onClick={handleClearFilters}
                className="w-full text-slate-600 hover:text-slate-900"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Plan & Billing</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Period Dates</th>
                <th className="py-3 px-4">Renewal / Flags</th>
                <th className="py-3 px-4 text-right">Actions</th>
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
                      <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-6 w-20 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-16 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-8 w-20 bg-slate-200 rounded inline-block" />
                    </td>
                  </tr>
                ))
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8">
                    <EmptyState
                      title="No subscriptions found"
                      description={
                        hasActiveFilters
                          ? "Try adjusting or clearing your active filters to see subscriptions."
                          : "No tenant subscriptions have been created on the platform yet."
                      }
                      actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                      onAction={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Organization */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/super-admin/tenants/${sub.tenant_id}`}
                        className="font-semibold text-slate-900 hover:text-indigo-600 flex items-center gap-1 group/link"
                      >
                        <span>{sub.tenant_name || "Unknown Tenant"}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </Link>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {sub.tenant_slug ? `${sub.tenant_slug}.bizflow.app` : sub.tenant_id}
                      </div>
                    </td>

                    {/* Plan & Billing */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        {sub.plan_name || sub.plan_code || "Custom Plan"}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-slate-700">
                          <MoneyText
                            amount={sub.plan_price ?? 0}
                            currency={sub.plan_currency || "INR"}
                          />
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="capitalize text-slate-500">
                          {sub.billing_interval?.toLowerCase() || "monthly"}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sub.status} />
                    </td>

                    {/* Period Dates */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1 font-medium text-slate-800">
                        <span>{formatDate(sub.starts_at)}</span>
                        <span className="text-slate-400">→</span>
                        <span>{formatDate(sub.ends_at)}</span>
                      </div>
                      {sub.trial_ends_at && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Trial ends: {formatDate(sub.trial_ends_at)}</span>
                        </div>
                      )}
                    </td>

                    {/* Renewal / Flags */}
                    <td className="py-3.5 px-4 text-xs">
                      {sub.cancel_at_period_end ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          Cancelling
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Auto-renewing</span>
                      )}
                      {sub.provider_subscription_ref && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[140px]" title={sub.provider_subscription_ref}>
                          Ref: {sub.provider_subscription_ref}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAdjustModal(sub)}
                        leftIcon={<Sliders className="h-3.5 w-3.5 text-indigo-600" />}
                        className="text-xs"
                      >
                        Adjust
                      </Button>
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
              {meta.total} total subscriptions)
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

      {/* Adjust Subscription Modal */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={closeAdjustModal}
        title="Adjust Tenant Subscription"
        description="Override subscription parameters or trigger administrative lifecycle adjustments."
        maxWidth="lg"
      >
        {selectedSub && (
          <form onSubmit={handleSubmit(onAdjustSubmit)} className="space-y-5">
            {/* Target Summary Card */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block mb-0.5">Tenant Organization</span>
                <span className="font-semibold text-slate-900 block truncate">
                  {selectedSub.tenant_name || selectedSub.tenant_id}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Plan</span>
                <span className="font-medium text-slate-800 block">
                  {selectedSub.plan_name || selectedSub.plan_code || "Custom"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={selectedSub.status} />
                </div>
              </div>
            </div>

            {/* Success Alert */}
            {adjustSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{adjustSuccess}</span>
              </div>
            )}

            {/* Error Alert */}
            {adjustError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-center gap-2 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            {/* Adjustment Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Adjustment Action *
              </label>
              <Select
                {...register("adjustment_type")}
                options={ADJUSTMENT_OPTIONS}
                error={errors.adjustment_type?.message}
              />
            </div>

            {/* Conditional Field: Extend Trial */}
            {selectedAdjustmentType === "EXTEND_TRIAL" && (
              <div>
                <Input
                  label="New Trial Expiration Date & Time *"
                  type="datetime-local"
                  {...register("trial_ends_at")}
                  error={errors.trial_ends_at?.message}
                  hint="Select a future timestamp up to which the trial should remain active."
                />
              </div>
            )}

            {/* Conditional Field: Change Plan */}
            {selectedAdjustmentType === "CHANGE_PLAN" && (
              <div>
                <Controller
                  control={control}
                  name="plan_id"
                  render={({ field }) => (
                    <PlanSelect
                      value={field.value}
                      onChange={field.onChange}
                      label="Target Subscription Plan *"
                      error={errors.plan_id?.message}
                      placeholder="Select target plan..."
                    />
                  )}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Changing plan will recompute tenant entitlement quotas based on the target plan.
                </p>
              </div>
            )}

            {/* Conditional Field: Mark Invoice as Paid */}
            {selectedAdjustmentType === "MARK_INVOICE_PAID" && (
              <div>
                <Input
                  label="Invoice ID to Reconcile *"
                  placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                  {...register("invoice_id")}
                  error={errors.invoice_id?.message}
                  hint="Enter the UUID of the invoice being marked as paid."
                />
              </div>
            )}

            {/* Conditional Warnings for Suspend / Manual Activate */}
            {selectedAdjustmentType === "SUSPEND" && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Account Suspension:</strong> This will suspend the tenant's workspace immediately. Users will lose write access until restored.
                </div>
              </div>
            )}

            {selectedAdjustmentType === "MANUAL_ACTIVATE" && (
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-xs text-sky-800 flex items-start gap-2">
                <CreditCard className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Manual Activation:</strong> Marks the subscription as Active without verifying a payment gateway webhook. Use with caution.
                </div>
              </div>
            )}

            {/* Audit Reason Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Audit Reason *
              </label>
              <textarea
                {...register("reason")}
                rows={3}
                placeholder="State the commercial or technical justification for this override..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              {errors.reason ? (
                <p className="mt-1 text-xs text-rose-600">{errors.reason.message}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  This note will be permanently logged in the Super Admin audit trail.
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeAdjustModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Apply Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
