import { ServerError } from './ServerError'
import {
  bridgeOrvalFailureToLegacyActions,
  bridgeOrvalStartToLegacyActions,
  bridgeOrvalSuccessToLegacyActions,
} from './reflux-bridge'

interface FetchWithAuthConfig extends RequestInit {
  method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
}

/**
 * Central HTTP mutator used by all Orval-generated clients.
 *
 * Why this file exists:
 * - It standardizes auth headers and error handling for generated API calls.
 * - It is the single best interception point for successful and failed mutations,
 *   regardless of whether callers use `useMutation` hooks or direct async calls.
 *
 * Migration goal:
 * - During Reflux → react-query migration, we emit selected legacy Reflux
 *   actions after Orval mutation responses so old listeners keep updating while
 *   components are incrementally migrated.
 * - Once legacy listeners are retired, bridge emission can be removed from
 *   here in one place.
 *
 * On error throws either TypeError, NotAllowedError, AbortError (see MDN) or {@link ServerError}
 */
export const fetchWithAuth = async <T>(url: string, config: FetchWithAuthConfig): Promise<T> => {
  // Need to support old token (64 characters - prior to Django 4.1) and new token (32 characters).
  const csrfCookie = document.cookie.match(/csrftoken=(\w{32,64})/)

  // Request-time legacy lifecycle callbacks such as `started` must fire before
  // the fetch so they remain distinct from response-time `completed` callbacks.
  bridgeOrvalStartToLegacyActions(url, config)

  const response = await fetch(url, {
    ...config,
    headers: {
      ...config.headers,
      Accept: 'application/json',
      // Pass authentication data only when it's required.
      ...(config.method !== 'GET' ? { 'Content-Type': 'application/json' } : null),
      ...(config.method !== 'GET' && csrfCookie ? { 'X-CSRFToken': csrfCookie[1] } : null),
    },
  })

  if (!response.ok) {
    const error = await ServerError.new(response)

    bridgeOrvalFailureToLegacyActions(url, config, {
      error,
      data: error.parsedResponse,
      status: response.status,
      headers: response.headers,
    })

    throw error
  }

  const result = {
    data:
      response.status !== 204 && response.headers.get('content-type')?.indexOf('application/json') !== -1
        ? await response.json()
        : {},
    status: response.status,
    headers: response.headers,
  } as T

  // Bridge successful mutation responses to legacy Reflux `.completed` events.
  // Failed responses are bridged before throwing so legacy `.failed` handlers
  // can continue to show the same alerts and recovery paths.
  bridgeOrvalSuccessToLegacyActions(url, config, result as { data: unknown; status: number; headers: Headers })

  return result
}

export default fetchWithAuth
