import React from 'react';
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange';
import {observer} from 'mobx-react';
import type {SubscriptionInfo, ProductInfo} from './subscriptionStore';
import type {ServiceUsage} from './dataUsageStore';
import {handleApiFail} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import './planRoute.scss';

/**
 * TODO: Most probably all different Account routes will use very similar design,
 * so it would only make sense to define a very generic and reusable BEMs.
 *
 * See: https://www.figma.com/file/dyA3ivXUxmSjjFruqmW4T4/Data-storage-and-billing-options
 */
bem.AccountPlan = makeBem(null, 'account-plan');

bem.AccountPlan__header = makeBem(bem.AccountPlan, 'header', 'h2');
bem.AccountPlan__blurb = makeBem(bem.AccountPlan, 'blurb', 'b');
// Plan details parent div
bem.AccountPlan__info = makeBem(bem.AccountPlan, 'info');
// Plan text description
bem.AccountPlan__description = makeBem(bem.AccountPlan, 'description');
bem.AccountPlan__descriptionHeader = makeBem(bem.AccountPlan, 'description-header');
bem.AccountPlan__descriptionBlurb = makeBem(bem.AccountPlan, 'description-blurb');
// Data usage
bem.AccountPlan__data = makeBem(bem.AccountPlan, 'data');
// Component inside data usage that shows range
bem.PlanUsageRow = makeBem(null, 'plan-usage-row');
bem.PlanUsageRow__header = makeBem(bem.PlanUsageRow, 'header');
bem.PlanUsageRow__data = makeBem(bem.PlanUsageRow, 'data');

// Stripe table parent div
bem.AccountPlan__stripe = makeBem(bem.AccountPlan, 'stripe');

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
      url: `${ROOT_URL}/api/v2/stripe/subscriptions/`,
    })
      .done(this.onFetchSubscriptionInfoDone.bind(this))
      .fail(handleApiFail);
  }

  private onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    this.setState({
      subscribedProduct: response.results[0].plan.product,
    });
  }

  private getOneDecimalDisplay(x: number): number {
    return parseFloat(x.toFixed(1));
  }

  private fetchDataUsage() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/service_usage/`,
    })
      .done(this.onFetchDataUsageDone.bind(this))
      .fail(handleApiFail);
  }

  private onFetchDataUsageDone(response: ServiceUsage) {
    this.setState({
      dataUsageBytes: response.total_storage_bytes,
      dataUsageMonthly: response.total_submission_count_current_month,
    });
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
      <bem.AccountPlan__description>
        <bem.AccountPlan__descriptionHeader>
          {this.state.subscribedProduct.name}
        </bem.AccountPlan__descriptionHeader>
        <bem.AccountPlan__descriptionBlurb>
          {this.state.subscribedProduct.description}
        </bem.AccountPlan__descriptionBlurb>
      </bem.AccountPlan__description>
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
        <bem.AccountPlan>
          <bem.AccountPlan__header>{t('Current Plan')}</bem.AccountPlan__header>
          <bem.AccountPlan__info>
            <bem.AccountPlan__data>
              <bem.PlanUsageRow>
                <bem.PlanUsageRow__data>
                  {/* TODO: we temporarily use KoboRange here, but finally we
                      should build a tailored solution here - one that will
                      not require misusing an interactive component :)
                  */}
                  <KoboRange
                    max={MAX_PERCENTAGE}
                    value={this.getOneDecimalDisplay(MONTHLY_USAGE_PERCENTAGE)}
                    currentLabel={'Monthly submissions'}
                    totalLabel={'%'}
                    color={this.getUsageColor()}
                    singleStat
                  />
                </bem.PlanUsageRow__data>
              </bem.PlanUsageRow>

              <bem.PlanUsageRow>
                <bem.PlanUsageRow__data>
                  {/* TODO: we temporarily use KoboRange here, but finally we
                      should build a tailored solution here - one that will
                      not require misusing an interactive component :)
                  */}
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
                </bem.PlanUsageRow__data>
              </bem.PlanUsageRow>
            </bem.AccountPlan__data>

            {this.renderPlanText()}
          </bem.AccountPlan__info>

          <bem.AccountPlan__header>{t('Upgrade')}</bem.AccountPlan__header>
          <bem.AccountPlan__blurb>
            {t('Add ons and upgrades to your plan')}
          </bem.AccountPlan__blurb>
          <bem.AccountPlan__stripe>
            {envStore.isReady && stripePublicKey && stripePricingTableID && (
              <stripe-pricing-table
                pricing-table-id={stripePricingTableID}
                publishable-key={stripePublicKey}
              />
            )}
          </bem.AccountPlan__stripe>
        </bem.AccountPlan>
      );
  }
}

export default observer(PlanRoute);
