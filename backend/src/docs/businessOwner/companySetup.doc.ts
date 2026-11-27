// Business Owner Swagger documentation: Section B - Organization & Company Setup Wizard.
export const companySetupDoc = {
  tags: [
    {
      name: "[Business Owner] Organization & Company Setup",
      description: "Company profile, legal settings, branches, departments, and team hierarchy setup APIs",
    },
  ],
  paths: {
    "/api/v1/company": {
      get: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Get company profile & preferences",
        description:
          "Returns legal name, logo, address, tax ID, locale, default currency, timezone, financial year, and numbering/module preferences for the verified tenant.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Company profile details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CompanyProfileResponse" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      },
      put: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Update company profile & preferences",
        description:
          "Updates company profile fields, tax ID, currency, timezone, financial year, numbering preferences, and module preferences. Writes an audit log entry.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateCompanyInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Company profile updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CompanyProfileResponse" },
              },
            },
          },
          "400": { description: "Validation error" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/v1/branches": {
      get: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "List company branches",
        description: "Lists all branches belonging to the company with optional status and search filters.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "List of branches",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BranchListResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Create a new branch",
        description: "Creates a branch with unique code, address JSONB, and status.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBranchInput" },
            },
          },
        },
        responses: {
          "201": { description: "Branch created successfully" },
          "409": { description: "Branch code already exists" },
        },
      },
      put: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Update branch (ID in body)",
        description: "Updates branch details using `id` in request body (or use PUT /api/v1/branches/{id}).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateBranchWithIdInput" },
            },
          },
        },
        responses: {
          "200": { description: "Branch updated successfully" },
          "404": { description: "Branch not found" },
        },
      },
    },
    "/api/v1/branches/{id}": {
      put: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Update branch by ID",
        description: "Updates branch name, code, address, status, or head office flag.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBranchInput" },
            },
          },
        },
        responses: {
          "200": { description: "Branch updated successfully" },
          "404": { description: "Branch not found" },
        },
      },
    },
    "/api/v1/departments": {
      get: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "List departments",
        description: "Lists all departments with branch and manager details. Supports filters: status, branchId, search.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
          { name: "branchId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "List of departments" },
        },
      },
      post: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Create a department",
        description: "Creates a new department linked to a branch and manager user.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDepartmentInput" },
            },
          },
        },
        responses: {
          "201": { description: "Department created successfully" },
        },
      },
    },
    "/api/v1/departments/{id}": {
      put: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Update department by ID",
        description: "Updates department name, branch, manager, or status.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDepartmentInput" },
            },
          },
        },
        responses: {
          "200": { description: "Department updated successfully" },
          "404": { description: "Department not found" },
        },
      },
    },
    "/api/v1/teams": {
      get: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "List teams with hierarchy & members",
        description: "Returns teams, department, parentTeamId, manager details, and assigned team members.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "List of teams and mapped members" },
        },
      },
      post: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Create a team & map members",
        description: "Creates a team with optional parentTeamId hierarchy, managerUserId, and memberIds mapping.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTeamInput" },
            },
          },
        },
        responses: {
          "201": { description: "Team created successfully" },
        },
      },
    },
    "/api/v1/teams/{id}": {
      put: {
        tags: ["[Business Owner] Organization & Company Setup"],
        summary: "Update team hierarchy & members",
        description: "Updates team details, parent team, manager, status, and replaces member mapping if memberIds is provided.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTeamInput" },
            },
          },
        },
        responses: {
          "200": { description: "Team updated successfully" },
          "404": { description: "Team not found" },
        },
      },
    },
  },
  schemas: {
    AddressObject: {
      type: "object",
      properties: {
        line1: { type: "string", example: "402, Tech Park Tower" },
        line2: { type: "string", example: "SG Highway" },
        city: { type: "string", example: "Ahmedabad" },
        state: { type: "string", example: "Gujarat" },
        country: { type: "string", example: "India" },
        postalCode: { type: "string", example: "380054" },
        phone: { type: "string", example: "+919876543210" },
        email: { type: "string", format: "email", example: "hq@apexsolutions.com" },
      },
    },
    UpdateCompanyInput: {
      type: "object",
      properties: {
        name: { type: "string", example: "Apex Solutions" },
        legalName: { type: "string", example: "Apex Solutions Private Limited" },
        logoUrl: { type: "string", example: "https://cdn.example.com/logo.png" },
        address: { $ref: "#/components/schemas/AddressObject" },
        taxId: { type: "string", example: "24AABCA1234D1Z5" },
        locale: { type: "string", example: "en-IN" },
        defaultCurrency: { type: "string", example: "INR" },
        timezone: { type: "string", example: "Asia/Kolkata" },
        financialYear: { type: "string", example: "APR-MAR" },
        numberingPreferences: {
          type: "object",
          properties: {
            invoicePrefix: { type: "string", example: "INV-" },
            quotationPrefix: { type: "string", example: "QTN-" },
            orderPrefix: { type: "string", example: "ORD-" },
            nextInvoiceNumber: { type: "integer", example: 1001 },
            resetAnnually: { type: "boolean", example: true },
          },
        },
        modulePreferences: {
          type: "object",
          example: { enableMultiBranch: true, defaultTaxRate: 18 },
        },
      },
    },
    CompanyProfileResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            company: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                legalName: { type: "string", nullable: true },
                slug: { type: "string" },
                logoUrl: { type: "string", nullable: true },
                address: { $ref: "#/components/schemas/AddressObject" },
                taxId: { type: "string", nullable: true },
                locale: { type: "string" },
                defaultCurrency: { type: "string" },
                timezone: { type: "string" },
                financialYear: { type: "string" },
                numberingPreferences: { type: "object", nullable: true },
                modulePreferences: { type: "object", nullable: true },
                status: { type: "string" },
              },
            },
          },
        },
      },
    },
    CreateBranchInput: {
      type: "object",
      required: ["name", "code"],
      properties: {
        name: { type: "string", example: "Mumbai Head Office" },
        code: { type: "string", example: "MUM-HQ" },
        address: { $ref: "#/components/schemas/AddressObject" },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
        isHeadOffice: { type: "boolean", default: false },
      },
    },
    UpdateBranchWithIdInput: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        code: { type: "string" },
        address: { $ref: "#/components/schemas/AddressObject" },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
        isHeadOffice: { type: "boolean" },
      },
    },
    BranchListResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            branches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  code: { type: "string" },
                  address: { $ref: "#/components/schemas/AddressObject" },
                  status: { type: "string" },
                  isHeadOffice: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    CreateDepartmentInput: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", example: "Enterprise Sales" },
        branchId: { type: "string", format: "uuid", nullable: true },
        managerUserId: { type: "string", format: "uuid", nullable: true },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
      },
    },
    CreateTeamInput: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", example: "West India Sales Team" },
        description: { type: "string", example: "Handles key accounts in Maharashtra & Gujarat" },
        departmentId: { type: "string", format: "uuid", nullable: true },
        parentTeamId: { type: "string", format: "uuid", nullable: true },
        managerUserId: { type: "string", format: "uuid", nullable: true },
        memberIds: { type: "array", items: { type: "string", format: "uuid" } },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
      },
    },
  },
} as const;
