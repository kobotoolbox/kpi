import { type Query, QueryClient } from '@tanstack/react-query'
import { notify } from '#/utils'
import { ServerError } from './ServerError'

/**
 * On error Orval's fetch mutator throws either:
 * - TypeError
 * - NotAllowedError (DOMException)
 * - AbortError (DOMException)
 * - {@link ServerError}
 */
export type OrvalFetchError = TypeError | DOMException | ServerError

/**
 * By default, every Orval request handles error with this routine, and the default can be overriden on per-hook basis.
 *
 * Error handling policy:
 * - backend owns error content: keep error messages updated in backend, don't ignore/override them on frontend.
 * - frontend owns error display: ideally nicely inline, by default with a toast using this default handler.
 *
 * Note that overriding default handler doesn't override snapshot restoration,
 * because that's part of the global handler instead.
 *
 * Example usages:
 * ```tsx
 *   query: {
 *     throwOnError: () => {                                      // BAD, don't override.
 *       notify(t('some custom message'), 'error')
 *       return false
 *     },
 *     throwOnError: () => null,                                  // BEST, but handle the error nicely inline instead!
 *     // no override                                             // GOOD, leave it to the default handler.
 *     throwOnError: (error: OrvalFetchError, query) => {         // GOOD, use callback for more than default handler.
 *       // Do more stuff.
 *       return onErrorDefaultHandler(error, query)
 *     },
 *   },
 *   mutation: {
 *     onError: () => notify(t('some custom message'), 'error'),  // BAD, don't override.
 *     onError: () => null,                                       // BEST, but handle the error nicely inline instead!
 *     // no override                                             // GOOD, leave it to the default handler.
 *     onError: (error: OrvalFetchError, variables, context) => { // GOOD, use callback for more than default handler.
 *       // Do more stuff.
 *       onErrorDefaultHandler(error, variables, context)
 *     },
 *   },
 * ```
 */
export function onErrorDefaultHandler(
  error: OrvalFetchError,
  _query: Query<unknown, OrvalFetchError, unknown, readonly unknown[]>,
): boolean
export function onErrorDefaultHandler(error: OrvalFetchError, _variables: unknown, _context: unknown): void
export function onErrorDefaultHandler(
  error: OrvalFetchError,
  _variablesOrQuery: unknown | Query<unknown, OrvalFetchError, unknown, readonly unknown[]>,
  _context?: unknown,
): boolean | void {
  if (error instanceof ServerError) {
    let detail: string | null = null
    try {
      detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)
    } catch {
      detail = String(error.detail)
    }
    notify(String(error), 'error', {}, `${error.name}: ${error.message} | ${detail}`)
  } else if (error instanceof TypeError) {
    notify(String(error), 'error', {}, `${error.name}: ${error.message}`)
  } else if (error instanceof DOMException && error.name === 'AbortError') {
    // Don't display error if user aborted the request.
  } else if (error instanceof DOMException && error.name === 'NotAllowedError') {
    notify(String(error), 'error', {}, `${error.name}: ${error.message}`)
  } else {
    notify(String(error), 'error', {}, `${error.name}: ${error.message}`)
  }

  // Query's `throwOnError` by default returns a false, whereas Mutation's `onError` return nothing.
  return _variablesOrQuery instanceof QueryClient ? false : undefined
}
