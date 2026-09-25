import type { UseQueryOptions } from '@tanstack/react-query'
import {
  type environmentRetrieveResponse,
  getEnvironmentRetrieveQueryKey,
  useEnvironmentRetrieve,
} from '#/api/react-query/configuration'

/**
 * Server configuration - branding, legal links, interface languages, which metadata fields exist, etc.
 * Pass a `select` to pick out the part a component needs.
 *
 * Use this rather than `useEnvironmentRetrieve` directly, for the `staleTime`: these are constants an
 * administrator edits, so one request per page load is enough.
 */
export const useEnvironmentQuery = <TData = environmentRetrieveResponse, TError = unknown>(
  options?: Omit<UseQueryOptions<environmentRetrieveResponse, TError, TData>, 'queryKey'>,
) =>
  useEnvironmentRetrieve<TData, TError>({
    query: {
      staleTime: Number.POSITIVE_INFINITY,
      ...options,
      queryKey: getEnvironmentRetrieveQueryKey(),
    },
  })
