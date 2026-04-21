/** Error wrapper that preserves the parsed JSON payload from failed API requests. */
export class PayloadResponseError extends Error {
  constructor(
    public payload: unknown,
    message: string,
  ) {
    super(message)
  }
}

/** Executes a JSON request and returns the Orval-like response shape while preserving error payloads. */
export async function executeJsonRequest<TResponse>(url: string, init: RequestInit): Promise<TResponse> {
  const csrfCookie = document.cookie.match(/csrftoken=(\w{32,64})/)

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.method !== 'GET' ? { 'Content-Type': 'application/json' } : null),
      ...(init.method !== 'GET' && csrfCookie ? { 'X-CSRFToken': csrfCookie[1] } : null),
      ...init.headers,
    },
  })

  const payload =
    response.status !== 204 && response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : {}

  if (!response.ok) {
    throw new PayloadResponseError(payload, `${response.status} ${response.statusText}`)
  }

  return {
    data: payload,
    status: response.status,
    headers: response.headers,
  } as TResponse
}
