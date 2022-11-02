import React, {useState} from 'react';
import {NavLink} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import bem from 'js/bem';
import Icon from 'js/components/common/icon';
import envStore from 'js/envStore';
import {ROUTES} from 'js/router/routerConstants';
import {IconName} from 'jsapp/fonts/k-icons';
import './accountSidebar.scss';

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

  return (
    <bem.FormSidebar m='account'>
      <AccountNavLink
        iconName='user'
        name={t('Profile')}
        to={ROUTES.ACCOUNT_SETTINGS}
      />
      <AccountNavLink
        iconName='lock-alt'
        name={t('Security')}
        to={ROUTES.SECURITY}
      />
      {env.isReady && env.data.stripe_public_key && (
        // TODO && subscribedProduct
        <AccountNavLink
          iconName='editor'
          name={t('Your Plan')}
          to={ROUTES.PLAN}
        />
      )}
    </bem.FormSidebar>
  );
}

export default observer(AccountSidebar);

// class xAccountSidebar extends React.Component<{}, AccountSidebarState> {
//   constructor(props: {}) {
//     super(props);
//     this.state = {
//       isLoading: true,
//       subscribedProduct: null,
//     };
//   }

//   componentDidMount() {
//     this.setState({
//       isLoading: false,
//     });

//     if (envStore.data.stripe_public_key) {
//       this.fetchSubscriptionInfo();
//     }
//   }

//   // FIXME: Need to rework router/mobx. As of now, attempting to use RootStore
//   // and injecting multiple stores clashes with how we do routes. When we finish
//   // these funcitons should be used from the store and removed here
//   fetchSubscriptionInfo() {
//     $.ajax({
//       dataType: 'json',
//       method: 'GET',
//       url: `${ROOT_URL}/api/v2/stripe/subscriptions/`,
//     })
//       .done(this.onFetchSubscriptionInfoDone.bind(this))
//       .fail(this.onFetchSubscriptionInfoFail.bind(this));
//   }

//   onFetchSubscriptionInfoDone(response: PaginatedResponse<SubscriptionInfo>) {
//     this.setState({
//       subscribedProduct: response.results[0].plan.product,
//     });
//   }

//   onFetchSubscriptionInfoFail(response: FailResponse) {
//     notify.error(response.responseText);
//   }

//   isAccountSelected(): boolean {
//     return location.hash.split('#')[1] === ROUTES.ACCOUNT_SETTINGS;
//   }

//   isDataStorageSelected(): boolean {
//     return location.hash.split('#')[1] === ROUTES.DATA_STORAGE;
//   }

//   isSecuritySelected(): boolean {
//     return location.hash.split('#')[1] === ROUTES.SECURITY;
//   }

//   isPlanSelected(): boolean {
//     return location.hash.split('#')[1] === ROUTES.PLAN;
//   }

//   // render() {
//   //   const sidebarModifier = 'account';

//   //   if (this.state.isLoading) {
//   //     return <LoadingSpinner />;
//   //   } else {
//   //     return (
//   //       <bem.FormSidebar m={sidebarModifier}>

//   //         {envStore.isReady &&
//   //           envStore.data.stripe_public_key &&
//   //           this.state.subscribedProduct && (
//   //           )}
//   //       </bem.FormSidebar>
//   //     );
//   //   }
//   // }
// }
