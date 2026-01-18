/**
 * Safely extracts an error message from an unknown error value.
 * Handles Error objects, strings, and other types.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
