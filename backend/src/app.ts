// Express ka setup: security, middlewares, routes, errors.
import "./config/env"; // pehle env check ho jaye
import { randomUUID } from "crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env, isProd } from "./config/env";
import { checkDb } from "./db";
import {
  businessOwnerSwaggerDocument,
  sharedSwaggerDocument,
  superAdminSwaggerDocument,
  swaggerDocument,
} from "./docs";
import routes from "./routes";
import { apiLimiter } from "./middlewares/rateLimiter";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { sendSuccess } from "./lib/response";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      rawBody?: Buffer;
    }
  }
}

const app = express();

// Proxy (Render, Railway, Nginx...) ke peeche ho to sahi IP milne ke liye
if (isProd) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  }),
);

// Har request ko ek id (audit logs aur error logs mein kaam aati hai)
app.use((req, res, next) => {
  req.requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

// Health checks
app.get("/health", (_req, res) => sendSuccess(res, { status: "ok" }));
app.get("/health/ready", async (_req, res, next) => {
  try {
    await checkDb();
    sendSuccess(res, { status: "ok", database: "up" });
  } catch (err) {
    next(err);
  }
});

app.get("/", (_req, res) => sendSuccess(res, { status: "ok" }));

// Swagger API docs (Role-wise dropdown + Search filter)
app.get("/docs/swagger.json", (_req, res) => res.json(swaggerDocument));
app.get("/docs/super-admin.json", (_req, res) => res.json(superAdminSwaggerDocument));
app.get("/docs/business-owner.json", (_req, res) => res.json(businessOwnerSwaggerDocument));
app.get("/docs/auth.json", (_req, res) => res.json(sharedSwaggerDocument));
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    explorer: true,
    customSiteTitle: "BizFlow360 API Docs",
    swaggerOptions: {
      urls: [
        { url: "/docs/swagger.json", name: "All APIs" },
        { url: "/docs/super-admin.json", name: "Super Admin APIs" },
        { url: "/docs/business-owner.json", name: "Business Owner APIs" },
        { url: "/docs/auth.json", name: "Auth & Health" },
      ],
      "urls.primaryName": "All APIs",
      filter: true,
      persistAuthorization: true,
    },
  }),
);

// Asli API
app.use("/api/v1", apiLimiter, routes);

// Hamesha sabse last mein
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
