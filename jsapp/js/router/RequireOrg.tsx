import type React from 'react'
import { useOrganizationsRetrieve } from '#/api/react-query/organizations'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { useSession } from '#/stores/useSession'

/**
 * Organization object is used globally.
 * Handle error once at the top for convenience to avoid error handling every time.
 *
 * @see also `useOrganizationQuery`
 */
export const RequireOrg = ({ children }: { children: React.ReactNode }) => {
  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid

  const orgQuery = useOrganizationsRetrieve(organizationId!, {
    query: {
      staleTime: 0, // As per default, always refetch on re-mount (e.g. refresh) and re-focus.
      queryKey: undefined as any, // Note: see Orval issue
      throwOnError(_error, query) {
        // `organizationId` must exist, unless it's changed (e.g. user added/removed from organization).
        // In such case, refetch `organizationId` to fetch the new organization.
        // DEBT: don't throw toast within `fetchGetUrl`.
        // DEBT: don't retry the failing url 3-4 times before switching to the new url.
        if (query.state.data?.status === 404) {
          session.refreshAccount()
        }
        return false
      },
    },
  })

  // React-query guards to assert `query.data`
  if (orgQuery.isPending) {
    return <LoadingSpinner />
  }
  if (orgQuery.error) {
    return <LoadingSpinner />
  } // TODO: Nicier error page.

  // Orval guards to assert `query.data.data`
  if (orgQuery.data?.status !== 200) {
    return <LoadingSpinner />
  }

  return children
}
