// Har error yahin aakar ek jaise format mein jaata hai: {success:false, code, message, errors?}
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { sendError } from "../lib/response";
import { isProd } from "../config/env";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    // 1) Humare apne errors
    if (err instanceof AppError) {
        return sendError(res, err.statusCode, err.code, err.message, err.errors);
    }

    // 2) Zod validation errors
    if (err instanceof ZodError) {
        const errors = err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
        }));
        return sendError(res, 400, "VALIDATION_ERROR", "Validation failed", errors);
    }

    // 3) Galat JSON ya bahut bada body
    if (err?.type === "entity.parse.failed") {
        return sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
    }
    if (err?.type === "entity.too.large") {
        return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body too large");
    }

    // 4) Postgres unique violation (23505) - Drizzle kabhi error ke andar "cause" mein code rakhta hai
    const pgCode = err?.code ?? err?.cause?.code;
    if (pgCode === "23505") {
        return sendError(res, 409, "CONFLICT", "Record already exists");
    }

    // 5) Baaki sab: unexpected error
    console.error(`[${req.requestId ?? "-"}]`, err);
    return sendError(
        res,
        500,
        "INTERNAL_ERROR",
        isProd ? "Something went wrong" : (err?.message ?? "Something went wrong"),
    );
};