// Server chalu karta hai. Chalane ke liye: npm run dev
import app from "./app";
import { env } from "./config/env";
import { closeDb } from "./db";

const server = app.listen(env.PORT, () => {
  console.log(`BizFlow API chal raha hai: http://localhost:${env.PORT}  (${env.NODE_ENV})`);
});

// Band karte waqt requests poori hone do, phir database connection band karo
async function shutdown(signal: string) {
  console.log(`\n${signal} mila, server band ho raha hai...`);
  server.close(async () => {
    await closeDb().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));