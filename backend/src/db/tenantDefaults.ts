// Naye tenant ke liye default module entitlements aur usage metrics initialize karta hai.
import type { Db } from "./index";
import {
  DEFAULT_MODULE_QUOTAS,
  MODULE_CODES,
  tenantEntitlements,
  usageMetrics,
} from "./schema";

export async function initializeTenantDefaults(
  executor: Pick<Db, "insert">,
  tenantId: string,
): Promise<void> {
  await executor.insert(usageMetrics).values({
    tenantId,
    seatsUsed: 1,
    storageUsedMb: 0,
    apiCallsUsed: 0,
  });

  await executor.insert(tenantEntitlements).values(
    MODULE_CODES.map((moduleCode) => ({
      tenantId,
      moduleCode,
      isEnabled: true,
      quotas: DEFAULT_MODULE_QUOTAS,
      entitlementVersion: 1,
    })),
  );
}
