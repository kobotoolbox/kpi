import React, {useContext, useMemo, useState} from 'react';
import {NavLink} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import styles from './accountSidebar.module.scss';
import cx from 'classnames';
import Icon from 'js/components/common/icon';
import type {IconName} from 'jsapp/fonts/k-icons';
import Badge from '../components/common/badge';
import subscriptionStore from 'js/account/subscriptionStore';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {useOrganizationQuery} from './stripe.api';

interface AccountNavLinkProps {
  iconName: IconName;
  name: string;
  to: string;
  isNew?: boolean;
}
function AccountNavLink(props: AccountNavLinkProps) {
  return (
    <NavLink
      to={props.to}
      className={({isActive}) =>
        cx(styles.navlink, isActive ? styles.activeNavlink : '')
      }
    >
      <label className={styles.navlinkLabel}>
        <Icon name={props.iconName} className={styles.navlinkIcon} size='xl' />
        <span className={props.isNew ? styles.newLinkLabelText : ''}>
          {props.name}
        </span>
        {props.isNew && <Badge color='light-blue' size='s' label='New' />}
      </label>
    </NavLink>
  );
}

function AccountSidebar() {
  const [showPlans, setShowPlans] = useState(false);

  const orgQuery = useOrganizationQuery();

  useWhenStripeIsEnabled(() => {
    if (!subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo();
    }
    setShowPlans(true);
  }, [subscriptionStore.isInitialised]);

  return (
    <nav className={styles.accountSidebar}>
      <AccountNavLink
        iconName='user'
        name={t('Profile')}
        to={ACCOUNT_ROUTES.ACCOUNT_SETTINGS}
      />
      <AccountNavLink
        iconName='lock-alt'
        name={t('Security')}
        to={ACCOUNT_ROUTES.SECURITY}
      />
      {orgQuery.data?.is_owner && (
        <>
          <AccountNavLink
            iconName='reports'
            name={t('Usage')}
            to={ACCOUNT_ROUTES.USAGE}
          />
          {showPlans && (
            <>
              <AccountNavLink
                iconName='editor'
                name={t('Plans')}
                to={ACCOUNT_ROUTES.PLAN}
              />
              <AccountNavLink
                iconName='plus'
                name={t('Add-ons')}
                to={ACCOUNT_ROUTES.ADD_ONS}
                isNew
              />
            </>
          )}
        </>
      )}
    </nav>
  );
}

export default observer(AccountSidebar);
