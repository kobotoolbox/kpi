import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Badge, { type BadgeColor } from '#/components/common/badge'
import styles from './organizationBadge.module.scss'

interface OrganizationBadgeProps {
  color: BadgeColor
}

export default function OrganizationBadge(props: OrganizationBadgeProps) {
  // TODO: move this logic to the parent component when we refactor it
  // into a functional component. OrganizationBadge should just be a
  // purely presentational component.
  const [organization] = useOrganizationAssumed()

  if (organization.is_mmo) {
    return (
      <div className={styles.root}>
        <Badge color={props.color} size='m' label={organization.name.toUpperCase()} />
      </div>
    )
  } else {
    return null
  }
}
