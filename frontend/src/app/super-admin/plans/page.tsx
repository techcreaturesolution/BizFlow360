"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  updatePlanStatus,
  parsePlatformError,
} from "@/lib/platform";
import type { PlanItem, PageMeta, UpsertPlanInput } from "@/types/platform";
import type { UpsertPlanFormData } from "@/lib/validations";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { Modal } from "@/components/super-admin/Modal";
import { MoneyText } from "@/components/super-admin/MoneyText";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { PlanUpsertModal } from "@/components/super-admin/PlanUpsertModal";
import { Button } from "@/components/ui/Button";

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [meta, setMeta] = useState<PageMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [intervalFilter, setIntervalFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Accessibility trigger ref
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [activeTriggerRef, setActiveTriggerRef] = useState<
    React.RefObject<HTMLElement | null> | undefined
  >(undefined);

  // Status toggle confirmation modal
  const [planToToggle, setPlanToToggle] = useState<PlanItem | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Debounced search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1);
    }, 400);
  };

  const fetchPlansList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getPlans({
        search: debouncedSearch || undefined,
        billing_interval: intervalFilter || undefined,
        active: activeFilter !== "" ? activeFilter : undefined,
        page: currentPage,
        limit: pageSize,
      });

      setPlans(res.plans);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, intervalFilter, activeFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchPlansList();
  }, [fetchPlansList]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormError(null);
    setFormSuccess(null);
    setActiveTriggerRef(createButtonRef);
    setIsModalOpen(true);
  };

  const openEditModal = async (plan: PlanItem) => {
    setEditingPlan(plan);
    setFormError(null);
    setFormSuccess(null);
    setActiveTriggerRef(undefined);

    try {
      const fullPlan = await getPlan(plan.id);
      setEditingPlan(fullPlan);
      setIsModalOpen(true);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    }
  };

  const onFormSubmit = async (formData: UpsertPlanFormData) => {
    setFormError(null);
    setFormSuccess(null);

    const payload: UpsertPlanInput = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      billing_interval: formData.billing_interval,
      price: Number(formData.price),
      currency: formData.currency.trim().toUpperCase(),
      trial_days: Number(formData.trial_days) || 0,
      active: Boolean(formData.active),
      quotas: {
        max_seats: Number(formData.quotas.max_seats),
        max_storage_mb: Number(formData.quotas.max_storage_mb),
        api_rate_limit: Number(formData.quotas.api_rate_limit),
      },
      modules: formData.modules.map((m) => ({
        module_code: m.module_code,
        enabled: Boolean(m.enabled),
        limit:
          m.limit !== null &&
          m.limit !== undefined &&
          m.limit !== ("" as unknown)
            ? Number(m.limit)
            : null,
      })),
    };

    try {
      if (editingPlan) {
        const updated = await updatePlan(editingPlan.id, payload);
        setFormSuccess(
          `Plan updated successfully! New version created: v${updated.version}`
        );
      } else {
        const created = await createPlan(payload);
        setFormSuccess(
          `Plan "${created.name}" created successfully (v${created.version})!`
        );
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
        fetchPlansList();
      }, 1200);
    } catch (err: unknown) {
      const parsed = parsePlatformError(err);
      setFormError(parsed);
    }
  };

  // Status toggle handler
  const handleConfirmToggleStatus = async () => {
    if (!planToToggle) return;
    setIsTogglingStatus(true);

    try {
      const nextActive = !planToToggle.active;
      await updatePlanStatus(planToToggle.id, nextActive);

      // Optimistically update list
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planToToggle.id ? { ...p, active: nextActive } : p
        )
      );

      setPlanToToggle(null);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            Subscription Plans
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure pricing tiers, resource quotas, module entitlements, and plan versioning.
          </p>
        </div>

        <Button
          ref={createButtonRef}
          variant="primary"
          size="md"
          onClick={openCreateModal}
          leftIcon={<Plus className="h-4 w-4" />}
          className="shadow-md shadow-indigo-600/20 shrink-0 self-start sm:self-auto"
        >
          Create Plan
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <div className="lg:col-span-5 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search by plan name or code..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all"
            />
          </div>

          {/* Billing Interval Filter */}
          <div className="lg:col-span-3">
            <select
              value={intervalFilter}
              onChange={(e) => {
                setIntervalFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600"
            >
              <option value="">All Billing Intervals</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>

          {/* Active Filter */}
          <div className="lg:col-span-3">
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600"
            >
              <option value="">All Statuses (Active & Inactive)</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>

          {/* Reset */}
          <div className="lg:col-span-1 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setDebouncedSearch("");
                setIntervalFilter("");
                setActiveFilter("");
                setCurrentPage(1);
              }}
              className="w-full text-xs h-9 px-2"
              title="Reset all filters"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {error && !isLoading && (
        <ErrorState
          title="Error Loading Plans"
          message={error}
          onRetry={fetchPlansList}
        />
      )}

      {/* Plans Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-8 bg-slate-100 rounded-lg w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-50 rounded-lg w-full" />
            ))}
          </div>
        ) : plans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Plan Name & Code</th>
                  <th className="py-3.5 px-4">Billing Interval</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Trial</th>
                  <th className="py-3.5 px-4">Resource Quotas</th>
                  <th className="py-3.5 px-4">Enabled Modules</th>
                  <th className="py-3.5 px-4">Version</th>
                  <th className="py-3.5 px-4">Active</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span className="block font-bold text-slate-900 text-sm">
                        {plan.name}
                      </span>
                      <span className="block font-mono text-[11px] text-indigo-600 font-semibold">
                        {plan.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={plan.billing_interval} />
                    </td>
                    <td className="py-3.5 px-4">
                      <MoneyText
                        amount={plan.price}
                        currency={plan.currency}
                        className="font-bold text-slate-900 text-sm"
                      />
                      <span className="block text-[10px] text-slate-400">
                        /{plan.billing_interval.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {plan.trial_days ? `${plan.trial_days} days` : "No trial"}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-600">
                      <div className="space-y-0.5">
                        <span className="block font-medium">
                          Seats: <strong>{plan.quotas?.max_seats ?? 0}</strong>
                        </span>
                        <span className="block text-slate-500">
                          Storage: {plan.quotas?.max_storage_mb ?? 0} MB
                        </span>
                        <span className="block text-slate-400">
                          Rate: {plan.quotas?.api_rate_limit ?? 0}/min
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {plan.modules &&
                        plan.modules.filter((m) => m.enabled).length > 0 ? (
                          plan.modules
                            .filter((m) => m.enabled)
                            .map((m) => (
                              <span
                                key={m.module_code}
                                className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 font-bold text-indigo-700 text-[10px]"
                              >
                                {m.module_code}
                              </span>
                            ))
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 font-bold">
                      v{plan.version}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => setPlanToToggle(plan)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                          plan.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                        }`}
                        title="Click to toggle active status"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            plan.active ? "bg-emerald-600" : "bg-slate-400"
                          }`}
                        />
                        <span>{plan.active ? "Active" : "Inactive"}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(plan)}
                        leftIcon={<Edit className="h-3 w-3" />}
                        className="h-8 text-xs font-semibold"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No Plans Found"
            description="No plans match your current filters. Create your first subscription plan to get started."
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={openCreateModal}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Create Plan
              </Button>
            }
          />
        )}

        {/* Pagination Bar */}
        {meta.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-400">|</span>
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-800">
                  {Math.min((meta.page - 1) * meta.limit + 1, meta.total)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800">
                  {Math.min(meta.page * meta.limit, meta.total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800">
                  {meta.total}
                </span>{" "}
                plans
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="h-8 text-xs px-2.5"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span className="font-bold text-slate-800 px-2">
                Page {meta.page} of {Math.max(meta.totalPages, 1)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= meta.totalPages || isLoading}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, meta.totalPages))
                }
                className="h-8 text-xs px-2.5"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Redesigned Plan Upsert Modal (Create & Edit) */}
      <PlanUpsertModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingPlan={editingPlan}
        onSubmit={onFormSubmit}
        formError={formError}
        formSuccess={formSuccess}
        triggerRef={activeTriggerRef}
      />

      {/* Toggle Status Confirmation Modal */}
      <Modal
        isOpen={Boolean(planToToggle)}
        onClose={() => setPlanToToggle(null)}
        title={planToToggle?.active ? "Deactivate Plan" : "Activate Plan"}
        description="Modify availability of this subscription plan."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to{" "}
            {planToToggle?.active ? "deactivate" : "activate"}{" "}
            <strong className="text-slate-900">{planToToggle?.name}</strong> (
            {planToToggle?.code})?
            {planToToggle?.active && (
              <span className="block mt-1 text-amber-600">
                Deactivating prevents new tenants from selecting this plan. Existing subscribers remain active.
              </span>
            )}
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPlanToToggle(null)}
              disabled={isTogglingStatus}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={planToToggle?.active ? "danger" : "primary"}
              size="sm"
              onClick={handleConfirmToggleStatus}
              isLoading={isTogglingStatus}
            >
              {planToToggle?.active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
