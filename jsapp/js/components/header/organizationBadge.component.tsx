import {useOrganizationQuery} from 'js/account/organization/organizationQuery';
import Badge, {BadgeColor} from 'js/components/common/badge';
import styles from './organizationBadge.module.scss';

interface OrganizationBadgeProps {
  color: BadgeColor;
}

export default function OrganizationBadge(props: OrganizationBadgeProps) {
  // TODO: move this logic to the parent component when we refactor it
  // into a functional component. OrganizationBadge should just be a
  // purely presentational component.
  const orgQuery = useOrganizationQuery();

  if (orgQuery.data?.is_mmo) {
    return (
      <div className={styles.root}>
        <Badge color={props.color} size='m' label={orgQuery.data.name.toUpperCase()} />
      </div>
    );
  } else {
    return null;
  }
}
