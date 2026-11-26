// .env padhta hai aur check karta hai. Koi zaroori value missing ho to server start hi nahi hoga.
import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    APP_URL: z.string().url().default("http://localhost:3000"),
    // Frontend ke URL (comma se alag karke kai de sakte ho)
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    // App ke liye (Supabase pooler)
    DATABASE_URL: z.string().min(1, "DATABASE_URL zaroori hai"),
    // Migrations ke liye (Supabase direct connection) - drizzle.config.ts use karega
    DIRECT_URL: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET kam se kam 32 characters ka ho"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET kam se kam 32 characters ka ho"),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL: z.string().default("7d"),

    SUPER_ADMIN_NAME: z.string().trim().min(2).default("Super Admin"),
    SUPER_ADMIN_EMAIL: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("SUPER_ADMIN_EMAIL valid email hona chahiye")),
    SUPER_ADMIN_PASSWORD: z
      .string()
      .min(8, "SUPER_ADMIN_PASSWORD kam se kam 8 characters ka ho"),

    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    message: "JWT_ACCESS_SECRET aur JWT_REFRESH_SECRET alag-alag hone chahiye",
    path: ["JWT_REFRESH_SECRET"],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ .env mein galti hai:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";