"use client";

import React, { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Package,
  Layers,
  HardDrive,
  Users,
  Zap,
  Info,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Receipt,
  CheckSquare,
  FileText,
  UserCheck,
  Boxes,
  Briefcase,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Coins,
  ArrowRight,
  Sliders,
} from "lucide-react";

import type {
  PlanItem,
  UpsertPlanInput,
  ModuleCode,
  BillingInterval,
} from "@/types/platform";
import {
  upsertPlanSchema,
  type UpsertPlanFormData,
  MODULE_CODES,
} from "@/lib/validations";
import { Modal } from "@/components/super-admin/Modal";
import { MoneyText } from "@/components/super-admin/MoneyText";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR (₹) - Indian Rupee", symbol: "₹" },
  { value: "USD", label: "USD ($) - US Dollar", symbol: "$" },
  { value: "EUR", label: "EUR (€) - Euro", symbol: "€" },
  { value: "GBP", label: "GBP (£) - British Pound", symbol: "£" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

interface ModuleMeta {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODULE_METADATA: Record<ModuleCode, ModuleMeta> = {
  CRM: {
    name: "CRM",
    description: "Customer relationships, contacts & accounts",
    icon: Briefcase,
  },
  SALES: {
    name: "Sales",
    description: "Pipeline management, deals & revenue tracking",
    icon: TrendingUp,
  },
  FINANCE: {
    name: "Finance",
    description: "Invoicing, billing & account tracking",
    icon: Receipt,
  },
  TASKS: {
    name: "Tasks",
    description: "Project workflows & team work management",
    icon: CheckSquare,
  },
  DOCUMENTS: {
    name: "Documents",
    description: "Cloud file storage & digital asset sharing",
    icon: FileText,
  },
  HR: {
    name: "HR",
    description: "People directory, leave & staff management",
    icon: UserCheck,
  },
  INVENTORY: {
    name: "Inventory",
    description: "Stock levels, warehouses & item catalog",
    icon: Boxes,
  },
};

interface PlanUpsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPlan: PlanItem | null;
  onSubmit: (data: UpsertPlanFormData) => Promise<void>;
  formError: string | null;
  formSuccess: string | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function PlanUpsertModal({
  isOpen,
  onClose,
  editingPlan,
  onSubmit,
  formError,
  formSuccess,
  triggerRef,
}: PlanUpsertModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpsertPlanFormData>({
    resolver: zodResolver(upsertPlanSchema),
    defaultValues: {
      code: "",
      name: "",
      billing_interval: "MONTHLY",
      price: 999,
      currency: "INR",
      trial_days: 14,
      active: true,
      quotas: {
        max_seats: 10,
        max_storage_mb: 2048,
        api_rate_limit: 120,
      },
      modules: MODULE_CODES.map((code) => ({
        module_code: code,
        enabled: true,
        limit: null,
      })),
    },
  });

  const { fields: moduleFields } = useFieldArray({
    control,
    name: "modules",
  });

  // Watch form fields for live summary card
  const watchedValues = watch();
  const currentInterval = watchedValues.billing_interval || "MONTHLY";
  const currentCurrency = watchedValues.currency || "INR";
  const currentPrice = Number(watchedValues.price) || 0;
  const currentTrial = Number(watchedValues.trial_days) || 0;
  const currentSeats = watchedValues.quotas?.max_seats ?? 10;
  const currentStorageMb = Number(watchedValues.quotas?.max_storage_mb) || 0;
  const currentRateLimit = watchedValues.quotas?.api_rate_limit ?? 120;
  const currentActive = watchedValues.active;
  const modulesList = watchedValues.modules || [];
  const enabledModulesCount = modulesList.filter((m) => m.enabled).length;

  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || "₹";

  // Prefill when editing or reset when creating
  useEffect(() => {
    if (isOpen) {
      if (editingPlan) {
        const existingModules = editingPlan.modules || [];
        const mergedModules = MODULE_CODES.map((code) => {
          const found = existingModules.find((m) => m.module_code === code);
          return {
            module_code: code,
            enabled: found ? Boolean(found.enabled) : false,
            limit: found?.limit ?? null,
          };
        });

        reset({
          code: editingPlan.code,
          name: editingPlan.name,
          billing_interval: editingPlan.billing_interval,
          price: editingPlan.price,
          currency: editingPlan.currency || "INR",
          trial_days: editingPlan.trial_days ?? 0,
          active: Boolean(editingPlan.active),
          quotas: {
            max_seats: editingPlan.quotas?.max_seats ?? 10,
            max_storage_mb: editingPlan.quotas?.max_storage_mb ?? 2048,
            api_rate_limit: editingPlan.quotas?.api_rate_limit ?? 120,
          },
          modules: mergedModules,
        });
      } else {
        reset({
          code: "",
          name: "",
          billing_interval: "MONTHLY",
          price: 999,
          currency: "INR",
          trial_days: 14,
          active: true,
          quotas: {
            max_seats: 10,
            max_storage_mb: 2048,
            api_rate_limit: 120,
          },
          modules: MODULE_CODES.map((code) => ({
            module_code: code,
            enabled: true,
            limit: null,
          })),
        });
      }
    }
  }, [isOpen, editingPlan, reset]);

  // Handle Enable All / Disable All
  const handleToggleAllModules = (enable: boolean) => {
    const updated = modulesList.map((m) => ({
      ...m,
      enabled: enable,
    }));
    setValue("modules", updated, { shouldDirty: true, shouldValidate: true });
  };

  // Scroll to first invalid field on submit error
  const onInvalidSubmit = (fieldErrors: typeof errors) => {
    const firstErrorKey = Object.keys(fieldErrors)[0];
    if (firstErrorKey) {
      const el =
        document.querySelector<HTMLElement>(`[name="${firstErrorKey}"]`) ||
        document.querySelector<HTMLElement>(`[name^="${firstErrorKey}."]`) ||
        document.getElementById(`field-${firstErrorKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }
  };

  const isCodeConflict =
    formError &&
    (formError.toLowerCase().includes("code") ||
      formError.toLowerCase().includes("already exists"));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPlan ? `Edit Plan: ${editingPlan.name}` : "Create Subscription Plan"}
      description={
        editingPlan
          ? `Update configuration. Saving increments plan version from v${editingPlan.version} to v${editingPlan.version + 1}.`
          : "Define billing terms, resource allocations, and enterprise feature modules."
      }
      icon={<Package className="h-5 w-5 text-indigo-600" />}
      badge={
        editingPlan ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            v{editingPlan.version}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            New
          </span>
        )
      }
      maxWidth="3xl"
      noPadding
      isDirty={isDirty}
      triggerRef={triggerRef}
    >
      <form
        onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}
        className="flex flex-col flex-1 min-h-0"
        noValidate
      >
        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
          {/* Version Notice for Edit Mode */}
          {editingPlan && (
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 p-3.5 text-xs text-indigo-950 flex items-start gap-2.5 shadow-2xs">
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold text-indigo-900">
                  Versioned Configuration:
                </strong>{" "}
                Modifying this plan will create immutable version{" "}
                <span className="font-mono font-bold text-indigo-700">
                  v{editingPlan.version + 1}
                </span>
                . Existing tenant subscriptions locked to older versions will remain undisturbed.
              </div>
            </div>
          )}

          {/* Form-level Error Alert */}
          {formError && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900 flex items-start gap-2.5 shadow-2xs animate-fadeIn"
              role="alert"
            >
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-0.5">
                <span className="block font-bold">Failed to save plan</span>
                <span className="block font-normal text-rose-700">{formError}</span>
              </div>
            </div>
          )}

          {/* Form-level Success Alert */}
          {formSuccess && (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center gap-2.5 shadow-2xs animate-fadeIn"
              role="alert"
            >
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
              <div>{formSuccess}</div>
            </div>
          )}

          {/* Live Plan Summary Preview Card */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
                    Live Preview
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                      currentActive
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-700 text-slate-300 border border-slate-600"
                    )}
                  >
                    {currentActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2.5">
                  <h4 className="text-lg font-black tracking-tight text-white">
                    {watchedValues.name || "Untitled Plan"}
                  </h4>
                  <span className="font-mono text-xs text-indigo-400 font-semibold">
                    {watchedValues.code || "PLAN_CODE"}
                  </span>
                </div>
              </div>

              {/* Price & Billing Badge */}
              <div className="flex sm:flex-col sm:items-end justify-between items-center gap-1 bg-white/5 sm:bg-transparent rounded-xl p-2.5 sm:p-0">
                <div className="flex items-baseline gap-1 text-xl font-black text-white">
                  <span>{currencySymbol}</span>
                  <span>{currentPrice.toLocaleString()}</span>
                  <span className="text-xs font-normal text-slate-400">
                    /{currentInterval.toLowerCase()}
                  </span>
                </div>
                <span className="text-[11px] text-indigo-200 font-medium">
                  {currentTrial > 0 ? `${currentTrial}-day trial` : "No trial period"}
                </span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Users className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>
                  <strong>{currentSeats}</strong> seats
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <HardDrive className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>
                  <strong>{currentStorageMb} MB</strong> (
                  {(currentStorageMb / 1024).toFixed(1)} GB)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Zap className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>
                  <strong>{currentRateLimit}</strong> req/min
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>
                  <strong>{enabledModulesCount} of 7</strong> modules
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Basic Plan Information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                  Basic Information
                </h4>
                <p className="text-xs text-slate-500">
                  Unique programmatic code and tenant-facing display name.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Plan Code */}
              <div id="field-code" className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Plan Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Controller
                    control={control}
                    name="code"
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="e.g. STARTER_MONTHLY"
                        value={field.value || ""}
                        onChange={(e) => {
                          // Auto uppercase and replace whitespace with underscore
                          const sanitized = e.target.value
                            .toUpperCase()
                            .replace(/\s+/g, "_");
                          field.onChange(sanitized);
                        }}
                        className={cn(
                          "w-full h-11 rounded-xl border bg-white px-3.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 placeholder:font-sans transition-all duration-200",
                          "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                          errors.code || isCodeConflict
                            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
                            : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                        )}
                        aria-invalid={Boolean(errors.code || isCodeConflict)}
                        aria-describedby="code-hint"
                      />
                    )}
                  />
                </div>

                {/* Inline 409 error or zod error */}
                {(errors.code || isCodeConflict) && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 animate-fadeIn pt-0.5"
                    role="alert"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {errors.code?.message ||
                        "This plan code already exists. Please choose a unique code."}
                    </span>
                  </div>
                )}

                <p id="code-hint" className="text-[11px] text-slate-400">
                  Uppercase letters, numbers, hyphens or underscores (e.g. ENTERPRISE_2026).
                </p>
              </div>

              {/* Plan Name */}
              <div id="field-name" className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Plan Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Starter Tier"
                  {...register("name")}
                  className={cn(
                    "w-full h-11 rounded-xl border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200",
                    "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                    errors.name
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
                      : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                  )}
                  aria-invalid={Boolean(errors.name)}
                />

                {errors.name && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 animate-fadeIn pt-0.5"
                    role="alert"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.name.message}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Customer-facing name shown in workspace billing and checkout.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Billing Frequency */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Coins className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Pricing & Billing
                  </h4>
                  <p className="text-xs text-slate-500">
                    Set recurring intervals, currency, price, and complimentary trial days.
                  </p>
                </div>
              </div>

              {/* Price preview chip */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50/80 border border-indigo-100 text-xs font-semibold text-indigo-800">
                <span>{currencySymbol}</span>
                <span>{currentPrice.toLocaleString()}</span>
                <span className="text-indigo-400">/</span>
                <span className="capitalize">{currentInterval.toLowerCase()}</span>
                {currentTrial > 0 && (
                  <>
                    <span className="text-indigo-300">•</span>
                    <span className="text-indigo-600">{currentTrial}-day trial</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {/* Billing Interval Segmented Control */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Billing Interval <span className="text-rose-500">*</span>
                </label>
                <Controller
                  control={control}
                  name="billing_interval"
                  render={({ field }) => (
                    <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200 h-11 items-center">
                      <button
                        type="button"
                        onClick={() => field.onChange("MONTHLY")}
                        className={cn(
                          "h-9 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                          field.value === "MONTHLY"
                            ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("ANNUAL")}
                        className={cn(
                          "h-9 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                          field.value === "ANNUAL"
                            ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Annual
                      </button>
                    </div>
                  )}
                />
                <p className="text-[11px] text-slate-400">
                  Recurring invoice schedule assigned to subscribing tenants.
                </p>
              </div>

              {/* Currency Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Currency
                </label>
                <select
                  {...register("currency")}
                  className={cn(
                    "w-full h-11 rounded-xl border bg-white px-3.5 text-sm text-slate-900 font-medium transition-all duration-200",
                    "focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600",
                    errors.currency
                      ? "border-rose-400"
                      : "border-slate-300 hover:border-slate-400"
                  )}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Billing ledger currency.</p>
              </div>

              {/* Price Input with dynamic currency symbol prefix */}
              <div id="field-price" className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Price <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 font-bold text-sm">
                    {currencySymbol}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="999"
                    {...register("price")}
                    className={cn(
                      "w-full h-11 rounded-xl border bg-white pl-8 pr-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 transition-all duration-200",
                      "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                      errors.price
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
                        : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                    )}
                    aria-invalid={Boolean(errors.price)}
                  />
                </div>

                {errors.price && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 animate-fadeIn pt-0.5"
                    role="alert"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.price.message}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Zero for free plans.</p>
              </div>

              {/* Trial Days Input with "days" suffix */}
              <div id="field-trial_days" className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Trial Duration
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    {...register("trial_days")}
                    className={cn(
                      "w-full h-11 rounded-xl border bg-white pl-3.5 pr-14 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200",
                      "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                      errors.trial_days
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
                        : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                    )}
                    aria-invalid={Boolean(errors.trial_days)}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 text-xs font-medium">
                    days
                  </div>
                </div>

                {errors.trial_days && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 animate-fadeIn pt-0.5"
                    role="alert"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errors.trial_days.message}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">0 for immediate billing.</p>
              </div>
            </div>
          </div>

          {/* Section 3: Resource Quotas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <HardDrive className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                  Resource Quotas
                </h4>
                <p className="text-xs text-slate-500">
                  Compute, storage, and seat constraints enforced by the API gateway.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Max Seats Card */}
              <div
                id="field-quotas.max_seats"
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold">Max Seats</span>
                  <span className="text-rose-500">*</span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    placeholder="10"
                    {...register("quotas.max_seats")}
                    className={cn(
                      "w-full h-11 rounded-xl border bg-white pl-3.5 pr-14 text-sm font-bold text-slate-900 transition-all duration-200",
                      "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                      errors.quotas?.max_seats
                        ? "border-rose-400 focus:border-rose-500"
                        : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                    )}
                    aria-invalid={Boolean(errors.quotas?.max_seats)}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs font-semibold">
                    seats
                  </div>
                </div>

                {errors.quotas?.max_seats && (
                  <p className="text-xs text-rose-600 font-medium pt-0.5">
                    {errors.quotas.max_seats.message}
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  Max user accounts allowed in workspace.
                </p>
              </div>

              {/* Max Storage (MB) Card */}
              <div
                id="field-quotas.max_storage_mb"
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <HardDrive className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold">Max Storage</span>
                  <span className="text-rose-500">*</span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="2048"
                    {...register("quotas.max_storage_mb")}
                    className={cn(
                      "w-full h-11 rounded-xl border bg-white pl-3.5 pr-14 text-sm font-bold text-slate-900 transition-all duration-200",
                      "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                      errors.quotas?.max_storage_mb
                        ? "border-rose-400 focus:border-rose-500"
                        : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                    )}
                    aria-invalid={Boolean(errors.quotas?.max_storage_mb)}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs font-semibold">
                    MB
                  </div>
                </div>

                {errors.quotas?.max_storage_mb && (
                  <p className="text-xs text-rose-600 font-medium pt-0.5">
                    {errors.quotas.max_storage_mb.message}
                  </p>
                )}

                <p className="text-[11px] text-slate-500 font-medium">
                  {currentStorageMb > 0
                    ? `Equivalent to ${(currentStorageMb / 1024).toFixed(1)} GB disk space`
                    : "No storage quota"}
                </p>
              </div>

              {/* API Rate Limit Card */}
              <div
                id="field-quotas.api_rate_limit"
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <Zap className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold">API Rate Limit</span>
                  <span className="text-rose-500">*</span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="120"
                    {...register("quotas.api_rate_limit")}
                    className={cn(
                      "w-full h-11 rounded-xl border bg-white pl-3.5 pr-18 text-sm font-bold text-slate-900 transition-all duration-200",
                      "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
                      errors.quotas?.api_rate_limit
                        ? "border-rose-400 focus:border-rose-500"
                        : "border-slate-300 hover:border-slate-400 focus:border-indigo-600"
                    )}
                    aria-invalid={Boolean(errors.quotas?.api_rate_limit)}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs font-semibold">
                    req/min
                  </div>
                </div>

                {errors.quotas?.api_rate_limit && (
                  <p className="text-xs text-rose-600 font-medium pt-0.5">
                    {errors.quotas.api_rate_limit.message}
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  Throttling burst threshold per tenant API key.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Module Features & Limits */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Module Features & Limits
                  </h4>
                  <p className="text-xs text-slate-500">
                    Enable enterprise capabilities and configure optional usage caps.
                  </p>
                </div>
              </div>

              {/* Quick actions & counter */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  {enabledModulesCount} of 7 enabled
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleAllModules(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline px-1 py-0.5"
                >
                  Enable all
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleAllModules(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline px-1 py-0.5"
                >
                  Disable all
                </button>
              </div>
            </div>

            {/* 2-Column Responsive Module Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {moduleFields.map((field, idx) => {
                const meta = MODULE_METADATA[field.module_code] || {
                  name: field.module_code,
                  description: "Enterprise Module",
                  icon: Layers,
                };
                const ModuleIcon = meta.icon;
                const isEnabled = Boolean(watchedValues.modules?.[idx]?.enabled);

                return (
                  <div
                    key={field.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between space-y-3",
                      isEnabled
                        ? "border-indigo-400 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/20 shadow-xs"
                        : "border-slate-200 bg-slate-50/40 opacity-70 hover:opacity-100"
                    )}
                  >
                    {/* Module Header & Switch */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                            isEnabled
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                              : "bg-slate-200 text-slate-500 border-slate-300"
                          )}
                        >
                          <ModuleIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 leading-none">
                              {meta.name}
                            </span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                              {field.module_code}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1 leading-snug">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      {/* Accessible Switch Toggle */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          {...register(`modules.${idx}.enabled`)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                      </label>
                    </div>

                    {/* Optional Limit Input: ONLY shown when enabled */}
                    {isEnabled ? (
                      <div className="pt-2 border-t border-indigo-100/80 flex items-center justify-between gap-3 animate-fadeIn">
                        <span className="text-[11px] font-medium text-slate-600">
                          Usage limit:
                        </span>
                        <div className="w-36">
                          <input
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            {...register(`modules.${idx}.limit`)}
                            className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Module disabled</span>
                        <span className="italic">No access</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Plan Availability / Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                  currentActive
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-slate-100 text-slate-400 border-slate-200"
                )}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Plan Availability Status
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inactive plans cannot be assigned to new tenant organizations.
                  Existing subscriptions remain active.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
              <input
                type="checkbox"
                {...register("active")}
                className="sr-only peer"
              />
              <div className="w-12 h-6.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="border-t border-slate-200 bg-slate-50/95 backdrop-blur-md px-6 py-4 shrink-0 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 hidden sm:block">
            {editingPlan ? (
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>
                  Saving creates version{" "}
                  <strong className="text-indigo-700">
                    v{editingPlan.version + 1}
                  </strong>{" "}
                  (replaces v{editingPlan.version})
                </span>
              </span>
            ) : (
              <span className="text-slate-500">
                New plan will be initialized at{" "}
                <strong className="text-slate-700 font-mono">v1</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="shadow-sm shadow-indigo-600/20 px-5"
            >
              {editingPlan ? "Save Changes & Increment Version" : "Create Plan"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
