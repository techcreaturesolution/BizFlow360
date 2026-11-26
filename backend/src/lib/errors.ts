// Poore app ka ek hi error type. Service mein: throw Errors.conflict("Email already used")
export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace?.(this, AppError);
  }
}

export const Errors = {
  badRequest: (message = "Bad request", errors?: FieldError[]) =>
    new AppError(400, "BAD_REQUEST", message, errors),
  validation: (errors: FieldError[], message = "Validation failed") =>
    new AppError(400, "VALIDATION_ERROR", message, errors),
  unauthorized: (message = "Authentication required") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new AppError(404, "NOT_FOUND", message),
  conflict: (message = "Already exists") => new AppError(409, "CONFLICT", message),
  tooManyRequests: (message = "Too many requests, try again later") =>
    new AppError(429, "TOO_MANY_REQUESTS", message),
};