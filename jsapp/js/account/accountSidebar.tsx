import React, {useContext, useMemo, useState} from 'react';
import {NavLink} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import bem from 'js/bem';
import Icon from 'js/components/common/icon';
import type {IconName} from 'jsapp/fonts/k-icons';
import Badge from '../components/common/badge';
import subscriptionStore from 'js/account/subscriptionStore';
import './accountSidebar.scss';
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
    <NavLink to={props.to} className='form-sidebar__navlink'>
      {/* There shouldn't be a nested <a> tag here, NavLink already generates one */}
      <bem.FormSidebar__label>
        <Icon name={props.iconName} size='xl' />
        <bem.FormSidebar__labelText m={props.isNew ? 'isNew' : ''}>
          {props.name}
        </bem.FormSidebar__labelText>
        {props.isNew && <Badge color='light-blue' size='s' label='New' />}
      </bem.FormSidebar__label>
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

  const showAddOnsLink = useMemo(() => {
    return !subscriptionStore.planResponse.length;
  }, [subscriptionStore.isInitialised]);

  return (
    <bem.FormSidebar m='account'>
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
              {showAddOnsLink && (
                <AccountNavLink
                  iconName='plus'
                  name={t('Add-ons')}
                  to={ACCOUNT_ROUTES.ADD_ONS}
                  isNew
                />
              )}
            </>
          )}
        </>
      )}
    </bem.FormSidebar>
  );
}

export default observer(AccountSidebar);
