import styles from './accountSidebar.module.scss';
import React, {useContext, useMemo, useState} from 'react';
import {NavLink} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import Icon from 'js/components/common/icon';
import {IconName} from 'jsapp/fonts/k-icons';
import subscriptionStore from 'js/account/subscriptionStore';
import './accountSidebar.scss';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {OrganizationContext} from 'js/account/organizations/useOrganization.hook';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {OrgMemberRole} from './organizations/organizations.constants';

interface AccountNavLinkProps {
  iconName: IconName;
  name: string;
  to: string;
}
function AccountNavLink(props: AccountNavLinkProps) {
  return (
    <NavLink
      to={props.to}
      className={({isActive}) =>
        [styles.navlink, isActive ? styles.activeNavlink : ''].join(' ')
      }
    >
      <label className={styles.navlinkLabel}>
        <Icon name={props.iconName} className={styles.navlinkIcon} size='xl' />
        <span>{props.name}</span>
      </label>
    </NavLink>
  );
}

function BillingLinks() {
  const [showPlans, setShowPlans] = useState(true);
  useWhenStripeIsEnabled(() => {
    if (!subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo();
    }
    setShowPlans(true);
  }, [subscriptionStore.isInitialised]);

  return showPlans ? (
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
      />
    </>
  ) : null;
}

function AccountSidebar() {
  const [organization, _] = useContext(OrganizationContext);
  const displayOrgGroup = useMemo(() => true, [organization]);
  const orgRole = useMemo(() => OrgMemberRole.OWNER, [organization]);

  return (
    <nav className={styles.accountSidebar}>
      <div className={styles.navGroup}>
        <div className={styles.subhead}>{t('ACCOUNT')}</div>
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
        {!displayOrgGroup && (
          <>
            <BillingLinks />
            <AccountNavLink
              iconName='reports'
              name={t('Usage')}
              to={ACCOUNT_ROUTES.USAGE}
            />
          </>
        )}
      </div>
      {displayOrgGroup && (
        <div className={styles.navGroup}>
          <div className={styles.subhead}>{t('ORGANIZATION')}</div>
          <AccountNavLink
            iconName='user-share'
            name={t('Members')}
            to={ACCOUNT_ROUTES.ORGANIZATION_MEMBERS}
          />
          {[OrgMemberRole.OWNER, OrgMemberRole.ADMIN].includes(orgRole) && (
            <>
              <AccountNavLink
                iconName='reports'
                name={t('Usage')}
                to={ACCOUNT_ROUTES.USAGE}
              />
              {orgRole === OrgMemberRole.OWNER && <BillingLinks />}
              <AccountNavLink
                iconName='settings'
                name={t('Settings')}
                to={ACCOUNT_ROUTES.ORGANIZATION_SETTINGS}
              />
            </>
          )}
        </div>
      )}
    </nav>
  );
}

export default observer(AccountSidebar);
