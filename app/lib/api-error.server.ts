import { isApiError } from "~/lib/api-error";

/**
 * For use in loader catch blocks.
 *
 * Converts a structured ApiError into a thrown Response with the correct HTTP status,
 * triggering React Router's ErrorBoundary. Re-throws everything else untouched — this
 * is critical to not swallow redirect() throws from requireUser() and other auth guards.
 *
 * Usage:
 *   try { return await usersApi.getById(params.id); }
 *   catch (e) { throwApiError(e); }
 */
export function throwApiError(e: unknown): never {
  if (isApiError(e)) {
    throw new Response(e.message, { status: e.status });
  }
  throw e;
}

/**
 * For use in action catch blocks.
 *
 * Extracts the user-facing message from a structured ApiError, or returns the fallback
 * string for any other error type. Backend messages are already translated by I18nService,
 * so e.message is safe to surface directly to the user.
 *
 * Usage:
 *   try { await authApi.login(email, password); }
 *   catch (e) { return { error: getApiErrorMessage(e, "No fue posible iniciar sesión.") }; }
 */
export function getApiErrorMessage(
  e: unknown,
  fallback = "An unexpected error occurred.",
): string {
  if (isApiError(e)) return e.message;
  return fallback;
}
