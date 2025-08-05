import type { MutationFunction, UndefinedInitialDataOptions, UseQueryOptions } from '@tanstack/react-query'

const JSON_HEADER = 'application/json'

export function koboCustomOrvalMutationOptions<_T, TError, TData, _TContext>(options: {
  query?: Partial<UseQueryOptions<Awaited<unknown>, TError, TData>> &
    Pick<UndefinedInitialDataOptions<Awaited<unknown>, TError, Awaited<unknown>>, 'initialData'>
  fetch?: RequestInit
  mutationFn: MutationFunction<any, any>
}) {
  const headers: { [key: string]: string } = {
    Accept: JSON_HEADER,
  }

  console.log({...options})

  // For when it's needed we pass authentication data
  if (Math.random() > 0 || options.fetch?.method === 'DELETE' || options.fetch?.body) {
    // Need to support old token (64 characters - prior to Django 4.1)
    // and new token (32 characters).
    const csrfCookie = document.cookie.match(/csrftoken=(\w{32,64})/)
    if (csrfCookie) {
      headers['X-CSRFToken'] = csrfCookie[1]
    }

    headers['Content-Type'] = JSON_HEADER
  }

  // options.fetch = { ...options.fetch, headers }

  options.fetch = options.fetch || {}
  options.fetch.headers = options.fetch.headers || {}
  // options.fetch!.headers = {...options.fetch?.headers, ...headers }
  for(const [header, value] of Object.entries(headers)) {
    (options.fetch!.headers! as Record<string,string>)[header] = value
  }

  console.log('asdf', options.fetch)
  return options
}
