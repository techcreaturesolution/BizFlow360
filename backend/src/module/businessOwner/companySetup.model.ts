// Organization & Company Setup validation models (Company Profile, Branches, Departments, Teams).
import { z } from "zod";

const isValidTimezone = (tz: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const addressSchema = z
  .object({
    line1: z.string().trim().max(200).optional(),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().email().optional(),
  })
  .optional();

export const numberingPreferencesSchema = z
  .object({
    invoicePrefix: z.string().trim().max(20).optional(),
    quotationPrefix: z.string().trim().max(20).optional(),
    orderPrefix: z.string().trim().max(20).optional(),
    purchaseOrderPrefix: z.string().trim().max(20).optional(),
    nextInvoiceNumber: z.number().int().min(1).optional(),
    resetAnnually: z.boolean().optional(),
  })
  .optional();

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  legalName: z.string().trim().min(2).max(255).optional(),
  logoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/.+/.test(v), {
      message: "Logo URL must be a valid http/https URL",
    })
    .optional(),
  logoDocumentId: z.string().uuid().optional().nullable(),
  address: addressSchema,
  taxId: z.string().trim().max(100).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency 3-letter ISO code mein honi chahiye (jaise INR, USD)")
    .optional(),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimezone, { message: "Valid IANA timezone dalein (jaise Asia/Kolkata)" })
    .optional(),
  financialYear: z.string().trim().min(3).max(50).optional(),
  financialYearStart: z.string().trim().min(1).max(50).optional(),
  dateFormat: z.string().trim().min(4).max(30).optional(),
  numberingPreferences: numberingPreferencesSchema,
  numberingRules: numberingPreferencesSchema,
  modulePreferences: z.record(z.string(), z.unknown()).optional(),
  moduleSettings: z.record(z.string(), z.unknown()).optional(),
  expenseApprovalThreshold: z.coerce.number().min(0).optional(),
});

export const orgQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  branchId: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(2, "Branch name kam se kam 2 characters ka hona chahiye").max(150),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Branch code kam se kam 2 characters ka hona chahiye")
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, "Branch code sirf uppercase letters, numbers, - ya _ mein ho sakta hai"),
  address: addressSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  isHeadOffice: z.boolean().default(false),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  id: z.string().uuid().optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, "Department name kam se kam 2 characters ka hona chahiye").max(150),
  branchId: z.string().uuid("Valid Branch ID dalein").nullable().optional(),
  managerUserId: z.string().uuid("Valid Manager User ID dalein").nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  id: z.string().uuid().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Team name kam se kam 2 characters ka hona chahiye").max(150),
  description: z.string().trim().max(500).optional(),
  departmentId: z.string().uuid("Valid Department ID dalein").nullable().optional(),
  parentTeamId: z.string().uuid("Valid Parent Team ID dalein").nullable().optional(),
  managerUserId: z.string().uuid("Valid Manager User ID dalein").nullable().optional(),
  memberIds: z.array(z.string().uuid("Valid User ID dalein")).optional(),
  memberUserIds: z.array(z.string().uuid("Valid User ID dalein")).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateTeamSchema = createTeamSchema.partial();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type OrgQuery = z.infer<typeof orgQuerySchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
