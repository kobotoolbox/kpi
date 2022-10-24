import React from 'react';
import {ROUTES} from 'js/router/routerConstants';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Icon from 'js/components/common/icon';
import './accountSidebar.scss';
import envStore from 'js/envStore';
import type {SubscriptionInfo, ProductInfo} from './subscriptionStore';
import DataUsageStore from './dataUsageStore';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse, FailResponse} from 'js/dataInterface';
import dataUsageStore from './dataUsageStore';
import {observer} from 'mobx-react';
import {hashHistory} from 'react-router';

interface AccountSidebarState {
	isLoading: boolean;
  subscribedProduct: ProductInfo | null;
}

class AccountSidebar extends React.Component<
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

    //if (envStore.data.stripe_public_key) {
    //  this.fetchSubscriptionInfo();
    //}
    DataUsageStore.fetchDataUsage();
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

  onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    this.setState({
      subscribedProduct: response.results[0].plan.product ,
    });
  }

  onFetchSubscriptionInfoFail(response: FailResponse) {
    notify.error(response.responseText);
  }

  isAccountSelected(): boolean {
    return (
      location.hash.split('#')[1] === ROUTES.ACCOUNT_SETTINGS
    );
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
          <bem.FormSidebar__label
            m={{selected: this.isAccountSelected()}}
            href={'#' + ROUTES.ACCOUNT_SETTINGS}
          >
            <Icon name='user' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Profile')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>

          { /* hide "Security" entirely if nothing there is available */
            envStore.isReady && envStore.data.mfa_enabled &&
            <bem.FormSidebar__label
              m={{selected: this.isSecuritySelected()}}
              href={'#' + ROUTES.SECURITY}
              disabled={ !(envStore.isReady && envStore.data.mfa_enabled) }
            >
              <Icon name='lock-alt' size='xl'/>
              <bem.FormSidebar__labelText>
                {t('Security')}
              </bem.FormSidebar__labelText>
            </bem.FormSidebar__label>
          }

          {
            envStore.isReady &&
            //envStore.data.stripe_public_key &&
            //this.state.subscribedProduct &&
              <bem.FormSidebar__label
                m={{selected: this.isPlanSelected()}}
                href={'#' + ROUTES.PLAN}
              >
                <Icon name='editor' size='xl'/>
                <bem.FormSidebar__labelText>
                  {t('Your plan')}
                </bem.FormSidebar__labelText>
              </bem.FormSidebar__label>
          }
        </bem.FormSidebar>
      );
    }
  }
}

export default observer(AccountSidebar);
