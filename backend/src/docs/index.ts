// Sabhi module ke Swagger docs ko role-wise specs + combined OpenAPI 3.0.3 document mein merge karta hai.
import { env, isProd } from "../config/env";
import { authDoc } from "./auth/auth.doc";
import { approvalsNotificationsDoc } from "./businessOwner/approvalsNotifications.doc";
import { businessOwnerDoc } from "./businessOwner/businessOwner.doc";
import { companySetupDoc } from "./businessOwner/companySetup.doc";
import { coreCrmDoc } from "./businessOwner/coreCrm.doc";
import { coreOperationsDoc } from "./businessOwner/coreOperations.doc";
import { coreSalesDoc } from "./businessOwner/coreSales.doc";
import { dashboardReportsDoc } from "./businessOwner/dashboardReports.doc";
import { tenantBillingDoc } from "./businessOwner/tenantBilling.doc";
import { commonDoc } from "./common/common.doc";
import { healthDoc } from "./health/health.doc";
import { auditDoc } from "./supperadmin/audit.doc";
import { billingDoc } from "./supperadmin/billing.doc";
import { plansDoc } from "./supperadmin/plans.doc";
import { superAdminDoc } from "./supperadmin/superAdmin.doc";

interface DocModule {
  tags: readonly Record<string, unknown>[];
  paths: Record<string, unknown>;
  schemas: Record<string, unknown>;
}

function getOrderedServers(host?: string) {
  const localServer = {
    url: `http://localhost:${env.PORT}`,
    description: "Local development server",
  };
  const productionServer = {
    url: 
    ,
    description: "Production server (Render)",
  };

  if (host) {
    const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    return isLocalHost ? [localServer, productionServer] : [productionServer, localServer];
  }

  return isProd ? [productionServer, localServer] : [localServer, productionServer];
}

export function withDynamicServers<T extends { servers: unknown[] }>(doc: T, host?: string): T {
  return {
    ...doc,
    servers: getOrderedServers(host),
  };
}

function buildOpenApiSpec(title: string, description: string, modules: DocModule[]) {
  return {
    openapi: "3.0.3",
    info: {
      title,
      version: "1.0.0",
      description,
    },
    servers: getOrderedServers(),
    tags: modules.flatMap((m) => [...m.tags]),
    paths: Object.assign({}, ...modules.map((m) => m.paths)),
    components: {
      securitySchemes: commonDoc.securitySchemes,
      schemas: Object.assign({}, commonDoc.schemas, ...modules.map((m) => m.schemas)),
    },
  };
}

const sharedModules: DocModule[] = [healthDoc, authDoc];
const superAdminModules: DocModule[] = [superAdminDoc, plansDoc, billingDoc, auditDoc];
const businessOwnerModules: DocModule[] = [
  businessOwnerDoc,
  companySetupDoc,
  dashboardReportsDoc,
  tenantBillingDoc,
  approvalsNotificationsDoc,
  coreCrmDoc,
  coreSalesDoc,
  coreOperationsDoc,
];

export const sharedSwaggerDocument = buildOpenApiSpec(
  "BizFlow360 - Auth & Health APIs",
  "Shared login, registration, profile, and server health endpoints.",
  sharedModules,
);

export const superAdminSwaggerDocument = buildOpenApiSpec(
  "BizFlow360 - Super Admin APIs",
  "Platform owner (SUPER_ADMIN) dashboard endpoints.",
  superAdminModules,
);

export const businessOwnerSwaggerDocument = buildOpenApiSpec(
  "BizFlow360 - Business Owner APIs",
  "Company owner and workspace dashboard endpoints.",
  businessOwnerModules,
);

export const swaggerDocument = buildOpenApiSpec(
  "BizFlow360 - All APIs",
  "Complete BizFlow360 backend API documentation (Super Admin, Business Owner, and Shared Auth).",
  [...sharedModules, ...superAdminModules, ...businessOwnerModules],
);
