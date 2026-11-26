// Seed script: application ke malik (SUPER_ADMIN) ko users table mein create/update karta hai.
// Super Admin ki koi tenantId nahi hoti aur tenants table mein uski koi entry nahi banti.
// Chalane ke liye: npm run seed
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { closeDb, db } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/Password";

async function seedSuperAdmin() {
  const email = env.SUPER_ADMIN_EMAIL;
  const passwordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        tenantId: null,
        fullName: env.SUPER_ADMIN_NAME,
        passwordHash,
        roles: ["SUPER_ADMIN"],
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    console.log(`Super Admin updated: ${email} (tenantId: null)`);
    return;
  }

  await db.insert(users).values({
    tenantId: null,
    fullName: env.SUPER_ADMIN_NAME,
    email,
    phone: null,
    passwordHash,
    roles: ["SUPER_ADMIN"],
    isActive: true,
  });

  console.log(`Super Admin created: ${email} (tenantId: null)`);
}

seedSuperAdmin()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
