export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

async function insightZenFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const payload = await response.json()
      detail = payload.detail ?? JSON.stringify(payload)
    } catch (error) {
      // ignore json parse errors
    }
    throw new Error(detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function buildQuery(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    searchParams.append(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function getPaginated<T>(path: string, params: Record<string, unknown>) {
  return insightZenFetch<PaginatedResponse<T>>(`/api/insightzen/${path}${buildQuery(params)}`)
}

export async function getJson<T>(path: string) {
  return insightZenFetch<T>(`/api/insightzen/${path}`)
}

export async function postJson<T>(path: string, body: unknown) {
  return insightZenFetch<T>(`/api/insightzen/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function patchJson<T>(path: string, body: unknown) {
  return insightZenFetch<T>(`/api/insightzen/${path}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteResource(path: string) {
  return insightZenFetch<void>(`/api/insightzen/${path}`, {
    method: 'DELETE',
  })
}
