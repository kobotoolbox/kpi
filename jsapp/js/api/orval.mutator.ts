import { ServerError } from './ServerError'

interface FetchWithAuthConfig extends RequestInit {
  method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
}

/**
 * On error throws either TypeError, NotAllowedError, AbortError (see MDN) or {@link ServerError}
 */
export const fetchWithAuth = async <T>(url: string, config: FetchWithAuthConfig): Promise<T> => {
  // Need to support old token (64 characters - prior to Django 4.1) and new token (32 characters).
  const csrfCookie = document.cookie.match(/csrftoken=(\w{32,64})/)

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

  if (!response.ok) throw await ServerError.new(response)

  return {
    data:
      response.status !== 204 && response.headers.get('content-type')?.indexOf('application/json') !== -1
        ? await response.json()
        : {},
    status: response.status,
    headers: response.headers,
  } as T
}

export default fetchWithAuth
