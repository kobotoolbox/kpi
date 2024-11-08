import {useOrganizationQuery} from 'jsapp/js/account/stripe.api';
import styles from './organizationBadge.module.scss';
import cx from 'classnames';

interface OrganizationBadgeProps {
  style: 'header' | 'dropdown';
}

export default function OrganizationBadge(props: OrganizationBadgeProps) {
  // TODO: move this logic to the parent component when we refactor it
  // into a functional component. OrganizationBadge should just be a
  // purely presentational component.
  const orgQuery = useOrganizationQuery();

  if (orgQuery.data?.is_mmo) {
    return (
      <div className={cx(styles.root, styles[props.style])}>
        {orgQuery.data.name.toUpperCase()}
      </div>
    );
  } else {
    return null;
  }
}
