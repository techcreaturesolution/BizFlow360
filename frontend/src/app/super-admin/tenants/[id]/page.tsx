"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Globe,
  User,
  Mail,
  Phone,
  Clock,
  DollarSign,
  Calendar,
  Layers,
  Shield,
  Activity,
  HardDrive,
  Users,
  Edit,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Save,
  Server,
  Zap,
} from "lucide-react";

import {
  getTenant,
  updateTenant,
  updateTenantStatus,
  getEntitlements,
  updateEntitlements,
  getPlans,
  parsePlatformError,
} from "@/lib/platform";
import type {
  TenantDetail,
  TenantStatus,
  ModuleCode,
  TenantEntitlementItem,
  PlanItem,
} from "@/types/platform";
import {
  updateTenantSchema,
  updateTenantStatusSchema,
  type UpdateTenantFormData,
  type UpdateTenantStatusFormData,
  TENANT_STATUSES,
  MODULE_CODES,
} from "@/lib/validations";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { Modal } from "@/components/super-admin/Modal";
import { ErrorState, EmptyState } from "@/components/super-admin/ErrorState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +08:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST +09:00)" },
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR (₹) - Indian Rupee" },
  { value: "USD", label: "USD ($) - US Dollar" },
  { value: "EUR", label: "EUR (€) - Euro" },
  { value: "GBP", label: "GBP (£) - British Pound" },
  { value: "AED", label: "AED (د.إ) - UAE Dirham" },
  { value: "SGD", label: "SGD (S$) - Singapore Dollar" },
];

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [entitlements, setEntitlements] = useState<TenantEntitlementItem[]>([]);
  const [entitlementVersion, setEntitlementVersion] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);

  // Entitlements save feedback
  const [isSavingEntitlements, setIsSavingEntitlements] = useState(false);
  const [entitlementMessage, setEntitlementMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchTenantData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setError(null);
    setIs404(false);

    try {
      const [detailData, entitlementsData, plansData] = await Promise.all([
        getTenant(tenantId),
        getEntitlements(tenantId).catch(() => null),
        getPlans({ limit: 100 }).catch(() => ({ plans: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } })),
      ]);

      setTenant(detailData);
      setPlans(plansData.plans || []);

      // Build complete 7-module list with fallback defaults for missing modules
      const existingEntitlements =
        entitlementsData?.entitlements || detailData.entitlements || [];

      if (existingEntitlements.length > 0 && existingEntitlements[0].entitlement_version) {
        setEntitlementVersion(existingEntitlements[0].entitlement_version);
      }

      const mergedModules: TenantEntitlementItem[] = MODULE_CODES.map((code) => {
        const found = existingEntitlements.find((m) => m.module_code === code);
        if (found) return found;
        return {
          module_code: code,
          is_enabled: false,
          quotas: {
            max_seats: 10,
            max_storage_mb: 1024,
            max_api_calls: 10000,
          },
        };
      });

      setEntitlements(mergedModules);
    } catch (err: unknown) {
      const parsed = parsePlatformError(err);
      if (parsed.includes("not found")) {
        setIs404(true);
      } else {
        setError(parsed);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  // Edit Tenant Form
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<UpdateTenantFormData>({
    resolver: zodResolver(updateTenantSchema),
  });

  const openEditModal = () => {
    if (tenant) {
      resetEdit({
        name: tenant.name,
        timezone: tenant.timezone,
        default_currency: tenant.default_currency,
      });
      setEditError(null);
      setEditSuccess(null);
      setIsEditModalOpen(true);
    }
  };

  const onEditSubmit = async (formData: UpdateTenantFormData) => {
    setEditError(null);
    setEditSuccess(null);

    // Only send fields that actually changed
    const changes: UpdateTenantFormData = {};
    if (formData.name !== tenant?.name) changes.name = formData.name;
    if (formData.timezone !== tenant?.timezone) changes.timezone = formData.timezone;
    if (formData.default_currency !== tenant?.default_currency)
      changes.default_currency = formData.default_currency;

    if (Object.keys(changes).length === 0) {
      setIsEditModalOpen(false);
      return;
    }

    try {
      const updated = await updateTenant(tenantId, changes);
      setTenant(updated);
      setEditSuccess("Tenant details updated successfully!");

      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      setEditError(parsePlatformError(err));
    }
  };

  // Change Status Form
  const {
    register: registerStatus,
    handleSubmit: handleSubmitStatus,
    watch: watchStatus,
    setValue: setStatusValue,
    formState: { errors: statusErrors, isSubmitting: isStatusSubmitting },
  } = useForm<UpdateTenantStatusFormData>({
    resolver: zodResolver(updateTenantStatusSchema),
    defaultValues: {
      status: tenant?.status || "TRIAL",
      reason: "",
    },
  });

  const selectedStatus = watchStatus("status");

  const openStatusModal = (prefillStatus?: TenantStatus) => {
    setStatusValue("status", prefillStatus || tenant?.status || "TRIAL");
    setStatusValue("reason", "");
    setStatusError(null);
    setStatusSuccess(null);
    setIsStatusModalOpen(true);
  };

  const onStatusSubmit = async (formData: UpdateTenantStatusFormData) => {
    setStatusError(null);
    setStatusSuccess(null);

    try {
      const updated = await updateTenantStatus(tenantId, {
        status: formData.status,
        reason: formData.reason,
      });
      setTenant(updated);
      setStatusSuccess(`Status changed to ${formData.status} successfully!`);

      setTimeout(() => {
        setIsStatusModalOpen(false);
        setStatusSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      setStatusError(parsePlatformError(err));
    }
  };

  // Entitlement quota update handler
  const handleToggleModule = (code: ModuleCode) => {
    setEntitlements((prev) =>
      prev.map((item) =>
        item.module_code === code ? { ...item, is_enabled: !item.is_enabled } : item
      )
    );
  };

  const handleQuotaChange = (
    code: ModuleCode,
    field: "max_seats" | "max_storage_mb" | "max_api_calls",
    val: number
  ) => {
    setEntitlements((prev) =>
      prev.map((item) =>
        item.module_code === code
          ? {
              ...item,
              quotas: {
                ...item.quotas,
                [field]: Math.max(0, val),
              },
            }
          : item
      )
    );
  };

  const handleSaveEntitlements = async () => {
    setIsSavingEntitlements(true);
    setEntitlementMessage(null);

    try {
      const payload = {
        modules: entitlements.map((item) => ({
          module_code: item.module_code,
          is_enabled: Boolean(item.is_enabled),
          quotas: {
            max_seats: Number(item.quotas.max_seats) || 0,
            max_storage_mb: Number(item.quotas.max_storage_mb) || 0,
            max_api_calls: Number(item.quotas.max_api_calls) || 0,
          },
        })),
      };

      const result = await updateEntitlements(tenantId, payload);
      if (result.entitlements && result.entitlements.length > 0) {
        setEntitlements(result.entitlements);
        if (result.entitlements[0].entitlement_version) {
          setEntitlementVersion(result.entitlements[0].entitlement_version);
        }
      }

      setEntitlementMessage({
        type: "success",
        text: "Entitlements and module quotas saved successfully! Version incremented.",
      });

      setTimeout(() => setEntitlementMessage(null), 4000);
    } catch (err: unknown) {
      setEntitlementMessage({
        type: "error",
        text: parsePlatformError(err),
      });
    } finally {
      setIsSavingEntitlements(false);
    }
  };

  if (is404) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Building2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Tenant Not Found</h1>
          <p className="text-sm text-slate-500">
            The workspace with ID <span className="font-mono text-xs text-indigo-600">{tenantId}</span> does not exist or has been deleted.
          </p>
        </div>
        <Link href="/super-admin/tenants">
          <Button variant="primary" size="md" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Tenants List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/super-admin/tenants">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
            className="text-xs font-semibold"
          >
            All Tenants
          </Button>
        </Link>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs font-mono text-slate-600 truncate max-w-xs">{tenant?.name || tenantId}</span>
      </div>

      {error && !isLoading && (
        <ErrorState
          title="Failed to Load Tenant Details"
          message={error}
          onRetry={fetchTenantData}
        />
      )}

      {isLoading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 rounded-2xl bg-slate-200" />
            <div className="h-64 rounded-2xl bg-slate-200" />
          </div>
          <div className="h-96 rounded-2xl bg-slate-200" />
        </div>
      )}

      {!isLoading && tenant && (
        <>
          {/* Header Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {tenant.name}
                </h1>
                <StatusBadge status={tenant.status} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono text-indigo-600">
                  <Globe className="h-3.5 w-3.5" />
                  {tenant.slug}.bizflow.app
                </span>
                <span>•</span>
                <span>ID: <code className="text-slate-700">{tenant.id}</code></span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={openEditModal}
                leftIcon={<Edit className="h-3.5 w-3.5" />}
              >
                Edit Tenant
              </Button>

              <Button
                size="sm"
                variant="primary"
                onClick={() => openStatusModal()}
                leftIcon={<Shield className="h-3.5 w-3.5" />}
              >
                Change Status
              </Button>
            </div>
          </div>

          {/* 2-Column Info Grid: Overview & Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overview Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tenant Overview</h3>
                  <p className="text-[11px] text-slate-500">Owner, regional settings, and timeline</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-semibold uppercase">Owner Name</span>
                  <span className="font-bold text-slate-800">{tenant.owner?.full_name || "System"}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </span>
                  <span className="font-medium text-slate-700">{tenant.owner?.email || "-"}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </span>
                  <span className="text-slate-700">{tenant.owner?.phone || "Not provided"}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Timezone
                  </span>
                  <span className="font-medium text-slate-800">{tenant.timezone}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Default Currency
                  </span>
                  <span className="font-bold text-slate-800">{tenant.default_currency}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Subscription Plan
                  </span>
                  <span className="font-semibold text-slate-800 truncate max-w-xs">
                    {(() => {
                      if (!tenant.plan_id) return "No Plan Assigned";
                      const match = plans.find((p) => p.id === tenant.plan_id);
                      return match ? `${match.name} (${match.code})` : tenant.plan_id;
                    })()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Created
                  </span>
                  <span className="text-slate-500">
                    {tenant.created_at ? new Date(tenant.created_at).toLocaleString() : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Usage Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Current Resource Usage</h3>
                  <p className="text-[11px] text-slate-500">Active consumption across seats, storage, and API</p>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                {/* Seats */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                      Active Seats Used
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {tenant.current_usage?.seats_used ?? 1} seats
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: "20%" }} />
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-blue-600" />
                      Storage Consumed
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {tenant.current_usage?.storage_used_mb ?? 0} MB
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: "5%" }} />
                  </div>
                </div>

                {/* API Calls */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-600" />
                      API Calls Used
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {tenant.current_usage?.api_calls_used ?? 0} calls
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: "2%" }} />
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 text-[11px] text-slate-500">
                  💡 Module-specific limits can be configured in the Entitlements section below.
                </div>
              </div>
            </div>
          </div>

          {/* Entitlements & Module Quotas Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Server className="h-5 w-5 text-indigo-600" />
                  Module Entitlements & Resource Quotas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure enabled enterprise modules and allocate max seats, storage, and monthly API limits.
                  <span className="ml-2 font-mono text-[11px] text-indigo-600 font-semibold">
                    (Version: v{entitlementVersion})
                  </span>
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleSaveEntitlements}
                isLoading={isSavingEntitlements}
                leftIcon={<Save className="h-4 w-4" />}
                className="shadow-md shadow-indigo-600/20"
              >
                Save Entitlements
              </Button>
            </div>

            {/* Notification message */}
            {entitlementMessage && (
              <div
                className={`rounded-xl border p-3.5 text-xs font-semibold flex items-center gap-2 ${
                  entitlementMessage.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {entitlementMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{entitlementMessage.text}</span>
              </div>
            )}

            {/* Entitlements Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entitlements.map((module) => (
                <div
                  key={module.module_code}
                  className={`rounded-xl border p-4.5 space-y-4 transition-all ${
                    module.is_enabled
                      ? "border-indigo-200 bg-indigo-50/20 shadow-sm"
                      : "border-slate-200 bg-slate-50/60 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900">
                        {module.module_code}
                      </span>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">
                        Enterprise Module
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={module.is_enabled}
                        onChange={() => handleToggleModule(module.module_code)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>

                  {/* Quota inputs */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Max Seats
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={module.quotas.max_seats}
                        disabled={!module.is_enabled}
                        onChange={(e) =>
                          handleQuotaChange(
                            module.module_code,
                            "max_seats",
                            Number(e.target.value)
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Max Storage (MB)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={module.quotas.max_storage_mb}
                        disabled={!module.is_enabled}
                        onChange={(e) =>
                          handleQuotaChange(
                            module.module_code,
                            "max_storage_mb",
                            Number(e.target.value)
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Max API Calls
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={module.quotas.max_api_calls}
                        disabled={!module.is_enabled}
                        onChange={(e) =>
                          handleQuotaChange(
                            module.module_code,
                            "max_api_calls",
                            Number(e.target.value)
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Edit Tenant Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Tenant Configuration"
        description="Update company name, primary timezone, and default currency settings."
      >
        <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
          {editError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {editError}
            </div>
          )}
          {editSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              {editSuccess}
            </div>
          )}

          <div>
            <Input
              label="Company Name"
              required
              placeholder="e.g. Apex Solutions Global"
              error={editErrors.name?.message}
              {...registerEdit("name")}
            />
          </div>

          <div>
            <Select
              label="Timezone"
              options={TIMEZONE_OPTIONS}
              error={editErrors.timezone?.message}
              {...registerEdit("timezone")}
            />
          </div>

          <div>
            <Select
              label="Default Currency"
              options={CURRENCY_OPTIONS}
              error={editErrors.default_currency?.message}
              {...registerEdit("default_currency")}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isEditSubmitting}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Change Tenant Lifecycle Status"
        description="Modify operational state. An audit reason is strictly mandatory."
      >
        <form onSubmit={handleSubmitStatus(onStatusSubmit)} className="space-y-4">
          {statusError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {statusError}
            </div>
          )}
          {statusSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              {statusSuccess}
            </div>
          )}

          {/* Quick status buttons */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatusValue("status", "ACTIVE")}
                className="text-xs"
              >
                Activate (ACTIVE)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatusValue("status", "SUSPENDED")}
                className="text-xs text-rose-600 hover:border-rose-300"
              >
                Suspend (SUSPENDED)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatusValue("status", "ARCHIVED")}
                className="text-xs text-slate-600"
              >
                Archive (ARCHIVED)
              </Button>
            </div>
          </div>

          <div>
            <Select
              label="Lifecycle Status"
              required
              options={TENANT_STATUSES.map((s) => ({ value: s, label: s }))}
              error={statusErrors.status?.message}
              {...registerStatus("status")}
            />
          </div>

          {/* Warning for revoking sessions */}
          {["SUSPENDED", "CANCELLED", "ARCHIVED"].includes(selectedStatus) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Session Revocation Warning:</strong>
                Setting status to <span className="font-mono font-bold">{selectedStatus}</span> will instantly revoke all active user login sessions and API tokens for this tenant.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Audit Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Requested account hold due to non-payment of invoice #1024"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600"
              {...registerStatus("reason")}
            />
            {statusErrors.reason && (
              <p className="text-xs font-medium text-rose-600 mt-1">
                {statusErrors.reason.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsStatusModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isStatusSubmitting}
            >
              Confirm Status Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
