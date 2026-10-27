import { recordAllauthResponse } from '#/auth/authChangeWatcher'
import { getCsrfToken } from '#/utils'
import { ServerError } from './ServerError'

interface FetchAllauthConfig extends RequestInit {
  method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
}

/**
 * Orval mutator for allauth headless endpoints.
 *
 * Unlike fetchWithAuth, this mutator returns most non-2xx responses as data rather
 * than throwing. The allauth headless protocol uses HTTP status codes as state
 * signals so callers inspect response.status in onSuccess rather than relying on onError.
 *
 * No Reflux bridge calls: allauth endpoints have no legacy listeners. Auth changes do get reported - every allauth
 * call passes through here, so `#/auth/authChangeWatcher` gets a look at every answer.
 */
export const fetchAllauth = async <T>(url: string, config: FetchAllauthConfig): Promise<T> => {
  const csrfToken = getCsrfToken()
  const hasFormDataBody = typeof FormData !== 'undefined' && config.body instanceof FormData

  const response = await fetch(url, {
    ...config,
    headers: {
      ...config.headers,
      Accept: 'application/json',
      ...(config.method !== 'GET' && !hasFormDataBody ? { 'Content-Type': 'application/json' } : null),
      ...(config.method !== 'GET' && csrfToken ? { 'X-CSRFToken': csrfToken } : null),
    },
  })

  if (response.status >= 500) {
    throw await ServerError.new(response)
  }

  const result = {
    data:
      response.status !== 204 && response.headers.get('content-type')?.indexOf('application/json') !== -1
        ? await response.json()
        : {},
    status: response.status,
    headers: response.headers,
  }

  // Before the caller gets it, so a screen reading the session in the same tick sees the new one.
  await recordAllauthResponse({ url, method: config.method }, result)

  return result as T
}

export default fetchAllauth
