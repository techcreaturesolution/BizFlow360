// Database connection (Supabase ke saath Drizzle ORM + postgres.js).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

// Supabase transaction pooler ke liye prepare: false zaroori hota hai
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
export type Db = typeof db;

export async function checkDb(): Promise<void> {
  await client`select 1`;
}

export async function closeDb(): Promise<void> {
  await client.end();
}
