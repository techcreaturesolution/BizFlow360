// Database connection (Supabase ke saath Drizzle ORM + postgres.js).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

// Supabase transaction pooler ke liye prepare: false + explicit pool timeouts zaroori hain (57014 prevention)
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;

export async function checkDb(): Promise<void> {
  await client`select 1`;
}

export async function closeDb(): Promise<void> {
  await client.end();
}
