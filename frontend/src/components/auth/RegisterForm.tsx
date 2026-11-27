"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Mail,
  Phone,
  Building2,
  Globe2,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { registerSchema, type RegisterFormData } from "@/lib/validations";
import { registerUser, parseRegisterError } from "@/lib/auth";
import { clearAuth, getAccessToken } from "@/lib/storage";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
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
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR (₹) - Indian Rupee" },
  { value: "USD", label: "USD ($) - US Dollar" },
  { value: "EUR", label: "EUR (€) - Euro" },
  { value: "GBP", label: "GBP (£) - British Pound" },
  { value: "AED", label: "AED (د.إ) - UAE Dirham" },
  { value: "SGD", label: "SGD (S$) - Singapore Dollar" },
  { value: "CAD", label: "CAD (C$) - Canadian Dollar" },
  { value: "AUD", label: "AUD (A$) - Australian Dollar" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

export function RegisterForm() {
  const router = useRouter();
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect already-logged-in users away from register
  useEffect(() => {
    if (getAccessToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      companyName: "",
      workspaceSlug: "",
      timezone: "Asia/Kolkata",
      defaultCurrency: "INR",
    },
    mode: "onTouched",
  });

  const companyNameValue = watch("companyName");
  const passwordValue = watch("password") || "";
  const workspaceSlugValue = watch("workspaceSlug") || "";

  // Auto-generate workspace slug when company name changes unless manually edited
  useEffect(() => {
    if (!isSlugManuallyEdited && companyNameValue) {
      const generatedSlug = slugify(companyNameValue);
      setValue("workspaceSlug", generatedSlug, {
        shouldValidate: generatedSlug.length >= 2,
        shouldDirty: true,
      });
    }
  }, [companyNameValue, isSlugManuallyEdited, setValue]);

  // Live Password Criteria evaluation
  const passwordCriteria = {
    length: passwordValue.length >= 8,
    upper: /[A-Z]/.test(passwordValue),
    number: /[0-9]/.test(passwordValue),
    symbol: /[^A-Za-z0-9]/.test(passwordValue),
  };

  const strengthCount = Object.values(passwordCriteria).filter(Boolean).length;
  const strengthPercentage = (strengthCount / 4) * 100;

  const getStrengthInfo = () => {
    if (!passwordValue) return { label: "", color: "bg-slate-200" };
    if (strengthCount === 4) return { label: "Strong", color: "bg-emerald-500" };
    if (strengthCount === 3) return { label: "Good", color: "bg-indigo-500" };
    if (strengthCount === 2) return { label: "Fair", color: "bg-amber-500" };
    return { label: "Weak", color: "bg-rose-500" };
  };

  const strengthInfo = getStrengthInfo();

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await registerUser({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        password: data.password,
        confirmPassword: data.confirmPassword,
        companyName: data.companyName,
        workspaceSlug: data.workspaceSlug,
        timezone: data.timezone,
        defaultCurrency: data.defaultCurrency,
      });

      if (response.success && response.data) {
        // Do NOT keep user logged in - require manual login as requested
        clearAuth();

        // Pass email to login page via sessionStorage
        if (typeof window !== "undefined" && data.email) {
          try {
            sessionStorage.setItem("registered_email", data.email);
          } catch {
            // ignore
          }
        }

        setSuccessMessage("Account created! Please login...");

        // Redirect to login with registered flag
        setTimeout(() => {
          router.push("/login?registered=true");
        }, 1000);
      }
    } catch (err: unknown) {
      const parsed = parseRegisterError(err);

      // Map any returned field-level errors to react-hook-form
      if (Object.keys(parsed.fieldErrors).length > 0) {
        Object.entries(parsed.fieldErrors).forEach(([field, msg]) => {
          if (
            [
              "fullName",
              "email",
              "phone",
              "password",
              "confirmPassword",
              "companyName",
              "workspaceSlug",
              "timezone",
              "defaultCurrency",
            ].includes(field)
          ) {
            setError(field as keyof RegisterFormData, {
              type: "server",
              message: msg,
            });
          }
        });
      }

      setServerError(parsed.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {/* Top Banner Alerts */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800 shadow-sm transition-all"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-900">Registration Failed</h4>
            <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-800 shadow-sm animate-fadeIn"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* Section 1: Personal Details */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              1
            </span>
            Personal Details
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Your name and primary contact details for account administration.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Full Name"
              required
              id="fullName"
              placeholder="e.g. Rahul Sharma"
              leftIcon={<User className="h-4 w-4" />}
              error={errors.fullName?.message}
              {...register("fullName")}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Work Email Address"
              required
              id="email"
              type="email"
              placeholder="e.g. rahul@apexsolutions.in"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register("email", {
                onChange: () => {
                  if (errors.email) clearErrors("email");
                },
              })}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Phone Number (Optional)"
              id="phone"
              type="tel"
              placeholder="+919876543210"
              hint="Include country code (e.g., +91 for India, +1 for US)"
              leftIcon={<Phone className="h-4 w-4" />}
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Security & Password */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              2
            </span>
            Security
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Create a secure password to protect your workspace.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <PasswordInput
              label="Password"
              required
              id="password"
              placeholder="Create strong password"
              error={errors.password?.message}
              {...register("password")}
            />

            {/* Password Strength Progress Bar */}
            {passwordValue.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">Strength:</span>
                  <span
                    className={
                      strengthCount >= 3
                        ? "text-emerald-600 font-semibold"
                        : strengthCount === 2
                        ? "text-amber-600 font-semibold"
                        : "text-rose-600 font-semibold"
                    }
                  >
                    {strengthInfo.label}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-300 ${strengthInfo.color}`}
                    style={{ width: `${strengthPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Password Requirements Checklist */}
            <div className="mt-3 rounded-lg bg-slate-50 p-3 border border-slate-200/60">
              <span className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Password Requirements
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <li
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordCriteria.length ? "text-emerald-600 font-medium" : "text-slate-400"
                  }`}
                >
                  {passwordCriteria.length ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>At least 8 characters</span>
                </li>
                <li
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordCriteria.upper ? "text-emerald-600 font-medium" : "text-slate-400"
                  }`}
                >
                  {passwordCriteria.upper ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>1 uppercase letter (A-Z)</span>
                </li>
                <li
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordCriteria.number ? "text-emerald-600 font-medium" : "text-slate-400"
                  }`}
                >
                  {passwordCriteria.number ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>1 number (0-9)</span>
                </li>
                <li
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordCriteria.symbol ? "text-emerald-600 font-medium" : "text-slate-400"
                  }`}
                >
                  {passwordCriteria.symbol ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>1 special symbol (!@#$%^&*)</span>
                </li>
              </ul>
            </div>
          </div>

          <PasswordInput
            label="Confirm Password"
            required
            id="confirmPassword"
            placeholder="Re-enter password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </div>
      </div>

      {/* Section 3: Company Workspace */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              3
            </span>
            Company Workspace
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure your dedicated multi-tenant domain and regional settings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Company / Business Name"
              required
              id="companyName"
              placeholder="e.g. Apex Solutions"
              leftIcon={<Building2 className="h-4 w-4" />}
              error={errors.companyName?.message}
              {...register("companyName")}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Workspace URL Slug"
              required
              id="workspaceSlug"
              placeholder="apex-solutions"
              hint="Letters, numbers, and hyphens only."
              error={errors.workspaceSlug?.message}
              {...register("workspaceSlug", {
                onChange: () => {
                  setIsSlugManuallyEdited(true);
                  if (errors.workspaceSlug) clearErrors("workspaceSlug");
                },
              })}
            />

            {/* Live Workspace URL Preview */}
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 px-3 py-2 text-xs text-indigo-900">
              <Globe2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="text-slate-600">Workspace domain:</span>
              <span className="font-mono font-medium text-indigo-700 truncate">
                {workspaceSlugValue ? `${workspaceSlugValue}.bizflow.app` : "your-workspace.bizflow.app"}
              </span>
            </div>
          </div>

          <div>
            <Select
              label="Timezone"
              required
              id="timezone"
              options={TIMEZONE_OPTIONS}
              error={errors.timezone?.message}
              {...register("timezone")}
            />
          </div>

          <div>
            <Select
              label="Default Currency"
              required
              id="defaultCurrency"
              options={CURRENCY_OPTIONS}
              error={errors.defaultCurrency?.message}
              {...register("defaultCurrency")}
            />
          </div>
        </div>
      </div>

      {/* Submit Button & Footer Link */}
      <div className="space-y-4 pt-2">
        <Button
          type="submit"
          size="lg"
          isLoading={isSubmitting}
          className="w-full text-base font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99] transition-transform"
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {isSubmitting ? "Creating your workspace..." : "Create Account & Workspace"}
        </Button>

        <p className="text-center text-xs text-slate-500">
          By signing up, you agree to BizFlow&apos;s Terms of Service and Privacy Policy.
        </p>

        <div className="text-center pt-2 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}
