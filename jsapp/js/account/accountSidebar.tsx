import React, {useEffect, useState} from 'react';
import {NavLink} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import bem from 'js/bem';
import Icon from 'js/components/common/icon';
import envStore from 'js/envStore';
import {ACCOUNT_ROUTES} from './routes';
import {IconName} from 'jsapp/fonts/k-icons';
import './accountSidebar.scss';
import {when} from 'mobx';

interface AccountNavLinkProps {
  iconName: IconName;
  name: string;
  to: string;
}
function AccountNavLink(props: AccountNavLinkProps) {
  return (
    <NavLink to={props.to} className='form-sidebar__navlink'>
      {/* There shouldn't be a nested <a> tag here, NavLink already generates one */}
      <bem.FormSidebar__label>
        <Icon name={props.iconName} size='xl' />
        <bem.FormSidebar__labelText>{props.name}</bem.FormSidebar__labelText>
      </bem.FormSidebar__label>
    </NavLink>
  );
}

function AccountSidebar() {
  const [env] = useState(() => envStore);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    const envPromise = when(() => env.isReady);
    envPromise.then(() => {
      if (env.data.stripe_public_key != null) {
        setShowPlans(true);
      }
    });
    // make sure to return a disposal function for when() so we don't cause a memory leak
    return envPromise.cancel;
  }, []);

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
      <AccountNavLink
        iconName='reports'
        name={t('Usage')}
        to={ACCOUNT_ROUTES.USAGE}
      />
      {showPlans && (
        <AccountNavLink
          iconName='editor'
          name={t('Plans')}
          to={ACCOUNT_ROUTES.PLAN}
        />
      )}
    </bem.FormSidebar>
  );
}

export default observer(AccountSidebar);
