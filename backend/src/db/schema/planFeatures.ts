// Plan features table: har plan ke enabled modules aur optional feature limits.
import {
  boolean,
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subscriptionPlans } from "./subscriptionPlans";

export const planFeatures = pgTable(
  "plan_features",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "cascade" }),
    moduleCode: varchar("module_code", { length: 50 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    limit: integer("limit"),
  },
  (table) => [
    index("plan_features_plan_id_idx").on(table.planId),
    uniqueIndex("plan_features_plan_module_uidx").on(table.planId, table.moduleCode),
  ],
);
