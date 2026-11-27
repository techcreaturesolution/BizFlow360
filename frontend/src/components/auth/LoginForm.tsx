"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Mail,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";

import { loginSchema, type LoginFormData } from "@/lib/validations";
import { loginUser, parseLoginError } from "@/lib/auth";
import { getAccessToken, getUser, saveAuth } from "@/lib/storage";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isRegisteredParam = searchParams.get("registered") === "true";
  const isSessionExpired = searchParams.get("session") === "expired";

  const [serverError, setServerError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(
    isRegisteredParam ? "Registration successful! Login with your credentials." : null
  );

  // Redirect already-logged-in users based on their role
  useEffect(() => {
    const token = getAccessToken();
    const user = getUser();
    if (token && user) {
      if (user.roles?.includes("SUPER_ADMIN")) {
        router.replace("/super-admin/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  // Prefill registered email from sessionStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const prefilledEmail = sessionStorage.getItem("registered_email");
        if (prefilledEmail) {
          setValue("email", prefilledEmail, { shouldValidate: true });
          sessionStorage.removeItem("registered_email");
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [setValue]);

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    try {
      const response = await loginUser({
        email: data.email,
        password: data.password,
      });

      if (response.success && response.data) {
        saveAuth({
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          user: response.data.user,
          tenant: response.data.tenant,
        });

        // Check if user is Super Admin
        const roles = response.data.user.roles || [];
        if (roles.includes("SUPER_ADMIN")) {
          router.push("/super-admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: unknown) {
      const message = parseLoginError(err);
      setServerError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Registration Success Banner */}
      {successBanner && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-800 shadow-sm animate-fadeIn"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-emerald-900">Welcome to BizFlow!</h4>
            <p className="mt-0.5 text-xs text-emerald-700 leading-relaxed">
              {successBanner}
            </p>
          </div>
        </div>
      )}

      {/* Session Expired Banner */}
      {isSessionExpired && !serverError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-800 shadow-sm animate-fadeIn"
        >
          <Info className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="font-medium text-xs">
            Your session has expired. Please sign in again to continue.
          </p>
        </div>
      )}

      {/* Server Error Alert Banner */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800 shadow-sm transition-all animate-fadeIn"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-900">Sign In Failed</h4>
            <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        <div>
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
                if (serverError) setServerError(null);
                if (errors.email) clearErrors("email");
              },
            })}
          />
        </div>

        <div>
          <PasswordInput
            label="Password"
            required
            id="password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register("password", {
              onChange: () => {
                if (serverError) setServerError(null);
                if (errors.password) clearErrors("password");
              },
            })}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="space-y-4 pt-2">
        <Button
          type="submit"
          size="lg"
          isLoading={isSubmitting}
          className="w-full text-base font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99] transition-transform"
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {isSubmitting ? "Signing in..." : "Sign In to Workspace"}
        </Button>

        {/* Footer Navigation */}
        <div className="text-center pt-3 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}
