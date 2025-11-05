import type { UseQueryOptions } from '@tanstack/react-query'
import type React from 'react'
import type { ErrorDetail } from '#/api/models/errorDetail'
import type { organizationsRetrieveResponse } from '#/api/react-query/user-team-organization-usage'
import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import { useSession } from '#/stores/useSession'

/**
 * For convenience, returns `Organization` directly that's assumed to be already cached, stale or not.
 * Pending-ness and errors are handled within `<RequireOrg />` at the top level by not rendering it's children.
 *
 * MUST be a descendant of `<RequireOrg />`!
 * Otherwise the assumption wont hold, and react app should crash loudly to let you know.
 *
 * Note: this hook uses a `useQuery` instead of `QueryClient.getQueryData`, so that
 * components can access query state and override options. E.g. see `OrganizationSettingsRoute`.
 */
export const useOrganizationAssumed = (
  options?: Omit<UseQueryOptions<organizationsRetrieveResponse, ErrorDetail>, 'queryKey'>,
) => {
  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid

  // Note: `!` is a workaround, see https://github.com/orval-labs/orval/issues/2397
  const query = useOrganizationsRetrieve(organizationId!, {
    query: {
      staleTime: Number.POSITIVE_INFINITY, // dont refetch, let <RequireOrg /> deal with in one place.
      ...options,
      queryKey: getOrganizationsRetrieveQueryKey(organizationId!), // Note: see Orval issue https://github.com/orval-labs/orval/issues/2396
    },
  })

  // React-query guards to assert `query.data`
  if (query.isPending) {
    throw new Error('useOrganizationAssumed() must be descendant of <RequireOrg />.')
  }
  if (query.error) {
    throw new Error('useOrganizationAssumed() must be descendant of <RequireOrg />.')
  }
  // Orval guards to assert `query.data.data`
  if (query.data?.status !== 200) {
    throw new Error('useOrganizationAssumed() must be descendant of <RequireOrg />.')
  }

  return [query.data.data, query] as const
}
