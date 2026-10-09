export async function facebookFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const body: unknown = await context.clone().json()
        if (
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof (body as { error?: unknown }).error === 'string'
        ) {
          return (body as { error: string }).error
        }
      } catch {
        return fallback
      }
    }
  }
  return error instanceof Error ? error.message : fallback
}
