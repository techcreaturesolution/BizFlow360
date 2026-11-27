// Auth module ke input/output models (register, login, session, password reset aur profile ke liye).
import { z } from "zod";
import type { TenantStatus } from "../../db/schema";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .pipe(z.email("Valid email address dalein"));

const strongPasswordField = z
  .string()
  .min(8, "Password kam se kam 8 characters ka hona chahiye")
  .max(128, "Password bahut lamba hai")
  .regex(/[A-Z]/, "Password mein kam se kam 1 uppercase letter hona chahiye")
  .regex(/[0-9]/, "Password mein kam se kam 1 number hona chahiye")
  .regex(/[^A-Za-z0-9]/, "Password mein kam se kam 1 symbol hona chahiye");

const isValidTimezone = (tz: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password bahut lamba hai"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: strongPasswordField,
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  password: strongPasswordField,
  fullName: z
    .string()
    .trim()
    .min(2, "Full Name kam se kam 2 characters ka hona chahiye")
    .max(100)
    .optional(),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full Name kam se kam 2 characters ka hona chahiye")
      .max(100, "Full Name bahut lamba hai"),
    email: emailField,
    phone: z
      .string()
      .trim()
      .transform((val) => (val === "" ? undefined : val.replace(/[\s-]+/g, "")))
      .refine((val) => val === undefined || /^\+[1-9]\d{6,14}$/.test(val), {
        message: "Phone number country code ke sath dalein (jaise +919876543210)",
      })
      .optional(),
    password: strongPasswordField,
    confirmPassword: z.string().optional(),
    companyName: z
      .string()
      .trim()
      .min(2, "Company Name kam se kam 2 characters ka hona chahiye")
      .max(120, "Company Name bahut lamba hai"),
    workspaceSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Workspace URL / Slug kam se kam 2 characters ka hona chahiye")
      .max(63, "Workspace URL / Slug bahut lamba hai")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug sirf lowercase letters, numbers aur hyphens (-) mein hona chahiye (jaise apex-solutions)",
      ),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .default("Asia/Kolkata")
      .refine(isValidTimezone, { message: "Valid IANA timezone dalein (jaise Asia/Kolkata)" }),
    defaultCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Default Currency 3-letter code mein honi chahiye (jaise INR, USD)")
      .default("INR"),
  })
  .refine(
    (data) => data.confirmPassword === undefined || data.password === data.confirmPassword,
    {
      message: "Password aur Confirm Password match nahi kar rahe",
      path: ["confirmPassword"],
    },
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string;
  defaultCurrency: string;
  planId: string | null;
}

export interface LoginUser {
  id: string;
  tenantId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  roles: string[];
}

export interface TenantMembershipInfo {
  id: string;
  tenantId: string;
  roleName: string;
  status: string;
  branchId: string | null;
  departmentId: string | null;
  joinedAt: Date | null;
}

export interface CurrentUserProfile {
  user: LoginUser;
  tenant: TenantInfo | null;
  membership: TenantMembershipInfo | null;
  effectivePermissions: string[];
  enabledModules: string[];
  managedDepartmentIds: string[];
  managedTeamIds: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: LoginUser;
  tenant: TenantInfo | null;
}
