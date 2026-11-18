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
 * Use this rather than `useEnvironmentRetrieve` directly, for the `staleTime`. Screens mount several observers of this
 * query moments apart - a minute covers that burst while still allowing letting a setting an administrator has just
 * changed to be picked up.
 */
export const useEnvironmentQuery = <TData = environmentRetrieveResponse, TError = unknown>(
  options?: Omit<UseQueryOptions<environmentRetrieveResponse, TError, TData>, 'queryKey'>,
) =>
  useEnvironmentRetrieve<TData, TError>({
    query: {
      staleTime: 1000 * 60, // 1 minute
      ...options,
      queryKey: getEnvironmentRetrieveQueryKey(),
    },
  })
