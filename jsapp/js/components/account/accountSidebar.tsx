import React from 'react';
import {Link} from 'react-router-dom';
import {ROUTES} from 'js/router/routerConstants';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Icon from 'js/components/common/icon';
import './accountSidebar.scss';
import envStore from 'js/envStore';
import {SubscriptionInfo, ProductInfo} from './subscriptionStore';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse, FailResponse} from 'js/dataInterface';

interface AccountSidebarState {
  isLoading: boolean;
  subscribedProduct: ProductInfo | null;
}

export default class AccountSidebar extends React.Component<
  {},
  AccountSidebarState
> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isLoading: true,
      subscribedProduct: null,
    };
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    });

    if (envStore.data.stripe_public_key) {
      this.fetchSubscriptionInfo();
    }
  }

  // FIXME: Need to rework router/mobx. As of now, attempting to use RootStore
  // and injecting multiple stores clashes with how we do routes. When we finish
  // these funcitons should be used from the store and removed here
  fetchSubscriptionInfo() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/stripe/subscriptions/`,
    })
      .done(this.onFetchSubscriptionInfoDone.bind(this))
      .fail(this.onFetchSubscriptionInfoFail.bind(this));
  }

  onFetchSubscriptionInfoDone(response: PaginatedResponse<SubscriptionInfo>) {
    this.setState({
      subscribedProduct: response.results[0].plan.product,
    });
  }

  onFetchSubscriptionInfoFail(response: FailResponse) {
    notify.error(response.responseText);
  }

  isAccountSelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.ACCOUNT_SETTINGS;
  }

  isDataStorageSelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.DATA_STORAGE;
  }

  isSecuritySelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.SECURITY;
  }

  isPlanSelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.PLAN;
  }

  render() {
    const sidebarModifier = 'account';

    if (this.state.isLoading) {
      return <LoadingSpinner />;
    } else {
      return (
        <bem.FormSidebar m={sidebarModifier}>
          <Link to={ROUTES.ACCOUNT_SETTINGS}>
            <bem.FormSidebar__label m={{selected: this.isAccountSelected()}}>
              <Icon name='user' size='xl' />
              <bem.FormSidebar__labelText>
                {t('Profile')}
              </bem.FormSidebar__labelText>
            </bem.FormSidebar__label>
          </Link>

          {
            /* hide "Security" entirely if nothing there is available */
            envStore.isReady && envStore.data.mfa_enabled && (
              <Link to={ROUTES.SECURITY}>
                <bem.FormSidebar__label
                  m={{selected: this.isSecuritySelected()}}
                  disabled={!(envStore.isReady && envStore.data.mfa_enabled)}
                >
                  <Icon name='lock-alt' size='xl' />
                  <bem.FormSidebar__labelText>
                    {t('Security')}
                  </bem.FormSidebar__labelText>
                </bem.FormSidebar__label>
              </Link>
            )
          }

          {envStore.isReady &&
            envStore.data.stripe_public_key &&
            this.state.subscribedProduct && (
              <Link to={ROUTES.PLAN}>
                <bem.FormSidebar__label m={{selected: this.isPlanSelected()}}>
                  <Icon name='editor' size='xl' />
                  <bem.FormSidebar__labelText>
                    {t('Your plan')}
                  </bem.FormSidebar__labelText>
                </bem.FormSidebar__label>
              </Link>
            )}
        </bem.FormSidebar>
      );
    }
  }
}
