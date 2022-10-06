import React from 'react';
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import AccessDenied from 'jsapp/js/router/accessDenied';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange';
import {observer} from 'mobx-react';
import type {SubscriptionInfo, ProductInfo} from './subscriptionStore';
import type {ServiceUsage} from './dataUsageStore';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse, FailResponse} from 'js/dataInterface';
import './planRoute.scss';

/*
 * TODO: Create a basic unified frame for account settings. Find somewhere to put the BEM declaration.
 * See: https://www.figma.com/file/dyA3ivXUxmSjjFruqmW4T4/Data-storage-and-billing-options?node-id=0%3A1
 * There will be repeated styles in elements such as the header, title, and the containing div for the component.
 * Every component except for `profile` should share this frame.
 */
bem.Plan = makeBem(null, 'plan');

bem.Plan__header = makeBem(bem.Plan, 'header', 'h2');
bem.Plan__blurb = makeBem(bem.Plan, 'blurb', 'b');
// Plan details parent div
bem.Plan__info = makeBem(bem.Plan, 'info');
// Plan text description
bem.Description = makeBem(null, 'description');
bem.Description__header = makeBem(bem.Description, 'header');
bem.Description__blurb = makeBem(bem.Description, 'blurb');
// Data usage
bem.Plan__data = makeBem(bem.Plan, 'data');
// Component inside data usage that shows range
bem.DataRow = makeBem(null, 'data-row');
bem.DataRow__header = makeBem(bem.DataRow, 'header');
bem.DataRow__data = makeBem(bem.DataRow, 'data');

// Stripe table parent div
bem.Plan__stripe = makeBem(bem.Plan, 'stripe');

const MAX_MONTHLY_SUBMISSIONS = 2; //TODO change this to 10000 after testing
const MAX_GIGABYTES_STORAGE = 4;
const WARNING_PERCENT = 75;
// Semi-hack: display proper range with a percentage as math using
// MAX_MONTHLY_SUBMISSIONS is already done later
const MAX_PERCENTAGE = 100;

const PLACEHOLDER_TITLE = t('Community plan (free access)');
const PLACEHOLDER_DESC = t('Free access to all services. 5GB of media attachments per account, 10,000 submissions per month, as well as 25 minutes of automatic speech recognition and 20,000 characters of machine translation per month.');

interface PlanRouteState {
  isLoading: boolean;
  subscribedProduct: ProductInfo;
  dataUsageBytes: number;
  dataUsageMonthly: number;
}

class PlanRoute extends React.Component<{}, PlanRouteState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isLoading: true,
      subscribedProduct: {
        id: '',
        name: PLACEHOLDER_TITLE,
        description: PLACEHOLDER_DESC,
        type: '',
        metadata: {}
      },
      dataUsageBytes: 0,
      dataUsageMonthly: 0,
    };
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    });

    if (envStore.data.stripe_public_key) {
      this.fetchSubscriptionInfo();
    }
    this.fetchDataUsage();
  }

  // FIXME: Need to rework router/mobx. As of now, attempting to use RootStore
  // and injecting multiple stores clashes with how we do routes. When we finish
  // these funcitons should be used from the store and removed here
  private fetchSubscriptionInfo() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/stripe/subscriptions`,
    })
      .done(this.onFetchSubscriptionInfoDone.bind(this))
      .fail(this.onFetchSubscriptionInfoFail.bind(this));
  }

  private onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    this.setState({
      subscribedProduct: response.results[0].plan.product,
    });
  }

  private onFetchSubscriptionInfoFail(response: FailResponse) {
    notify.error(response.responseText);
  }

  private getOneDecimalDisplay(x: number): number {
    return parseFloat(x.toFixed(1));
  }

  private fetchDataUsage() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/service_usage`,
    })
      .done(this.onFetchDataUsageDone.bind(this))
      .fail(this.onFetchDataUsageFail.bind(this));
  }

  private onFetchDataUsageDone(response: ServiceUsage) {
    this.setState({
      dataUsageBytes: response.total_storage_bytes,
      dataUsageMonthly: response.total_submission_count_current_month,
    });
  }

  private onFetchDataUsageFail(response: FailResponse) {
    notify.error(response.responseText);
  }

  private getUsageColor(): KoboRangeColors {
    if (
      (this.state.dataUsageMonthly / MAX_MONTHLY_SUBMISSIONS) *
        100 >=
      WARNING_PERCENT
    ) {
      return KoboRangeColors.warning;
    } else {
      return KoboRangeColors.teal;
    }
  }

  private renderPlanText() {
    return (
      <bem.Description>
        <bem.Description__header>
          {this.state.subscribedProduct.name}
        </bem.Description__header>
        <bem.Description__blurb>
          {this.state.subscribedProduct.description}
        </bem.Description__blurb>
      </bem.Description>
    );
  }

  render() {
    const stripePublicKey = envStore.data.stripe_public_key;
    const stripePricingTableID = envStore.data.stripe_pricing_table_id;

    const MONTHLY_USAGE_PERCENTAGE =
      (this.state.dataUsageMonthly / MAX_MONTHLY_SUBMISSIONS) * 100;
    const GIGABYTES_USAGE_PERCENTAGE =
      (this.state.dataUsageBytes / 1000000 / MAX_GIGABYTES_STORAGE) * 100;

      return (
        <bem.Plan>
          <bem.Plan__header>{t('Current Plan')}</bem.Plan__header>
          <bem.Plan__info>
            <bem.Plan__data>
              <bem.DataRow>
                <bem.DataRow__data>
                  <KoboRange
                    max={MAX_PERCENTAGE}
                    value={this.getOneDecimalDisplay(MONTHLY_USAGE_PERCENTAGE)}
                    currentLabel={'Monthly submissions'}
                    totalLabel={'%'}
                    color={this.getUsageColor()}
                    singleStat
                  />
                </bem.DataRow__data>
              </bem.DataRow>

              <bem.DataRow>
                <bem.DataRow__data>
                  <KoboRange
                    max={MAX_PERCENTAGE}
                    value={this.getOneDecimalDisplay(
                      GIGABYTES_USAGE_PERCENTAGE
                    )}
                    currentLabel={'Data storage'}
                    totalLabel={'%'}
                    color={this.getUsageColor()}
                    singleStat
                  />
                </bem.DataRow__data>
              </bem.DataRow>
            </bem.Plan__data>

            {this.renderPlanText()}
          </bem.Plan__info>

          <bem.Plan__header>{t('Upgrade')}</bem.Plan__header>
          <bem.Plan__blurb>
            {t('Add ons and upgrades to your plan')}
          </bem.Plan__blurb>
          <bem.Plan__stripe>
            {envStore.isReady && stripePublicKey && stripePricingTableID && (
              <stripe-pricing-table
                pricing-table-id={stripePricingTableID}
                publishable-key={stripePublicKey}
              />
            )}
          </bem.Plan__stripe>
        </bem.Plan>
      );
  }
}

export default observer(PlanRoute);
