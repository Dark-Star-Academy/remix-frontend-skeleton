export type ApiErrorCategory =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNPROCESSABLE"
  | "INTERNAL";

export interface ApiErrorResponse {
  code: string;
  category: ApiErrorCategory;
  message: string;
  status: number;
  timestamp: string;
}

const VALID_CATEGORIES = new Set<string>([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "UNPROCESSABLE",
  "INTERNAL",
]);

/**
 * Runtime shape validator. Returns true only if `v` matches the backend ErrorResponse DTO
 * exactly — correct types, recognized category, and status >= 400.
 * Intentionally strict to avoid false-positives on arbitrary JSON.
 */
export function isApiErrorResponse(v: unknown): v is ApiErrorResponse {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.code === "string" &&
    r.code.length > 0 &&
    typeof r.category === "string" &&
    VALID_CATEGORIES.has(r.category) &&
    typeof r.message === "string" &&
    typeof r.status === "number" &&
    r.status >= 400 &&
    typeof r.timestamp === "string"
  );
}

/**
 * Structured API error that carries the full backend ErrorResponse payload.
 * Extends Error for compatibility with React Router ErrorBoundary checks and
 * standard `instanceof Error` guards throughout the codebase.
 */
export class ApiError extends Error {
  readonly name = "ApiError";
  readonly code: string;
  readonly category: ApiErrorCategory;
  readonly status: number;
  readonly timestamp: string;

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.code = response.code;
    this.category = response.category;
    this.status = response.status;
    this.timestamp = response.timestamp;
  }
}

/**
 * Type guard for use in catch blocks and conditional branches.
 * Can be imported in both server and client modules.
 */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
