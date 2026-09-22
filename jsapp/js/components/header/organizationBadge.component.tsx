import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Badge, { type BadgeColor } from '#/components/common/badge'
import { useSession } from '#/stores/useSession'
import styles from './organizationBadge.module.scss'

interface OrganizationBadgeProps {
  color: BadgeColor
}

/** The organization's name next to the account avatar, for members of a multi-member organization. */
export default function OrganizationBadge(props: OrganizationBadgeProps) {
  // TODO: move this logic to the parent component when we refactor it
  // into a functional component. OrganizationBadge should just be a
  // purely presentational component.
  const session = useSession()
  const account = session.isPending ? undefined : session.currentLoggedAccount
  // An invalidated password gets a 403 from everything, so don't even ask: that account sees this menu only to reach
  // the logout button.
  const organizationId = account?.validated_password === false ? undefined : account?.organization?.uid

  const organizationQuery = useOrganizationsRetrieve(organizationId!, {
    query: {
      staleTime: Number.POSITIVE_INFINITY, // Same as everywhere else the organization is read.
      queryKey: getOrganizationsRetrieveQueryKey(organizationId!), // Note: see Orval issue https://github.com/orval-labs/orval/issues/2396
      // No error toast: a name we cannot read is handled inline by rendering nothing, the same way `RequireOrg`
      // swallows errors for this query. Otherwise every open of the account menu toasts, as an errored query refetches.
      throwOnError: () => false,
    },
  })

  // While the request is out, and if it never answers, there is no name to show - which is the same nothing
  // this badge renders for anyone outside a multi-member organization.
  const organization = organizationQuery.data?.status === 200 ? organizationQuery.data.data : undefined

  if (!organization?.is_mmo) {
    return null
  }

  return (
    <div className={styles.root}>
      <Badge color={props.color} size='m' label={organization.name.toUpperCase()} />
    </div>
  )
}
