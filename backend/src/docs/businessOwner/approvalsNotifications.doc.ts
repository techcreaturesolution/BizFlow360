// Business Owner Swagger documentation: Section E - Approvals & Notifications.
export const approvalsNotificationsDoc = {
  tags: [
    {
      name: "[Business Owner] Approvals & Notifications",
      description: "Approval inbox queue (quotations, expenses, purchases), approve/reject decisions with audit, in-app alerts, and preferences",
    },
  ],
  paths: {
    "/api/v1/approvals/inbox": {
      get: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Get approval inbox queue",
        description:
          "Lists pending (or filtered) quotation, expense, purchase order, and leave approval requests for the company.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] } },
          { name: "entityType", in: "query", schema: { type: "string", enum: ["QUOTATION", "EXPENSE", "PURCHASE_ORDER", "LEAVE_REQUEST"] } },
          { name: "branchId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "Paginated approval inbox queue with pending counts" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/v1/approvals/{id}/approve": {
      post: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Approve a pending request",
        description:
          "Marks the approval request as APPROVED, records actor + timestamp in audit_logs, and notifies the requester. Supports Idempotency-Key.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  comment: { type: "string", example: "Approved within Q4 budget" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Request approved successfully" },
          "404": { description: "Approval request not found" },
          "409": { description: "Approval request already decided" },
        },
      },
    },
    "/api/v1/approvals/{id}/reject": {
      post: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Reject a pending request",
        description:
          "Marks the approval request as REJECTED with a required reason/comment, records actor + timestamp in audit_logs, and notifies the requester. Supports Idempotency-Key.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: { type: "string", example: "Exceeds department approval limit without vendor quote" },
                  comment: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Request rejected successfully" },
          "400": { description: "Reason or comment is required" },
          "404": { description: "Approval request not found" },
          "409": { description: "Approval request already decided" },
        },
      },
    },
    "/api/v1/notifications": {
      get: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Get in-app notifications",
        description: "Returns paginated in-app alerts and total unreadCount for the logged-in user.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "isRead", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "category", in: "query", schema: { type: "string", enum: ["APPROVAL", "BILLING", "TEAM", "SALES", "FINANCE", "GENERAL"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "List of notifications and unreadCount" },
        },
      },
    },
    "/api/v1/notifications/{id}/read": {
      patch: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Mark a single notification as read",
        description: "Marks the specified notification as read with readAt timestamp.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Notification marked as read" },
          "404": { description: "Notification not found" },
        },
      },
    },
    "/api/v1/notifications/read-all": {
      post: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Mark all notifications as read",
        description: "Marks all unread in-app notifications for the current user as read.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "All unread notifications marked as read" },
        },
      },
    },
    "/api/v1/notification-preferences": {
      get: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Get email & in-app alert preferences (P1)",
        description: "Returns saved notification preferences (or default settings) for the logged-in user.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Notification preferences object" },
        },
      },
      put: {
        tags: ["[Business Owner] Approvals & Notifications"],
        summary: "Update email & in-app alert preferences (P1)",
        description: "Updates user's email and in-app notification toggles and records an audit log entry.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NotificationPreferencesInput" },
            },
          },
        },
        responses: {
          "200": { description: "Notification preferences updated" },
        },
      },
    },
  },
  schemas: {
    NotificationPreferencesInput: {
      type: "object",
      properties: {
        emailApprovals: { type: "boolean", example: true },
        emailBilling: { type: "boolean", example: true },
        emailTeamUpdates: { type: "boolean", example: true },
        emailDigestDaily: { type: "boolean", example: false },
        inAppApprovals: { type: "boolean", example: true },
        inAppBilling: { type: "boolean", example: true },
        inAppMentions: { type: "boolean", example: true },
        inAppTasks: { type: "boolean", example: true },
      },
    },
  },
} as const;
