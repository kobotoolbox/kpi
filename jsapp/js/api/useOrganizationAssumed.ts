import type { UseQueryOptions } from '@tanstack/react-query'
import type React from 'react'
import type { ErrorDetail } from '#/api/models/errorDetail'
import type { organizationsRetrieveResponse } from '#/api/react-query/organizations'
import { useOrganizationsRetrieve } from '#/api/react-query/organizations'
import { useSession } from '#/stores/useSession'

/**
 * For convenience, returns `Organization` directly that's assumed to exist.
 * Pending-ness and errrors are handled within `<RequireOrg />` at the top level by not rendering it's children.
 *
 * MUST be descendant of `<RequireOrg />`! Otherwise the react app should crash loudly to let you know.
 */
export const useOrganizationAssumed = (
  options?: Omit<UseQueryOptions<organizationsRetrieveResponse, ErrorDetail>, 'queryKey'>,
) => {
  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid

  const query = useOrganizationsRetrieve(organizationId!, {
    query: {
      staleTime: Number.POSITIVE_INFINITY, // dont refetch when mounting every of the many `useOrganization` instances.
      ...options,
      queryKey: undefined as any, // Note: see Orval issue
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
