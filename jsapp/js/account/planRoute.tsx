import React from 'react';
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange';
import {observer} from 'mobx-react';
import type {SubscriptionInfo, BaseProduct, Product } from './subscriptionStore';
import { fetchProducts } from './subscriptionStore';
import type {ServiceUsage} from './dataUsageStore';
import {handleApiFail} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import './planRoute.scss';
import {fetchGet, fetchPost, fetchDelete} from 'jsapp/js/api';

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

// Semi-hack: display proper range with a percentage as math using
// MAX_MONTHLY_SUBMISSIONS is already done later
const MAX_PERCENTAGE = 100;

const PLACEHOLDER_TITLE = t('Community plan (free access)');
const PLACEHOLDER_DESC = t('Free access to all services. 5GB of media attachments per account, 10,000 submissions per month, as well as 25 minutes of automatic speech recognition and 20,000 characters of machine translation per month.');

interface PlanRouteState {
  isLoading: boolean;
  subscribedProduct: BaseProduct;
  products: Product[];
  dataUsageBytes: number;
  dataUsageMonthly: number;
  intervalFilter: string;
  filterToggle: boolean;
  expandComparison: boolean;
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
      products: [],
      dataUsageBytes: 0,
      dataUsageMonthly: 0,
      intervalFilter: 'year',
      filterToggle: false,
      expandComparison: false,
    };
    this.setInterval = this.setInterval.bind(this);
    this.filterPrices = this.filterPrices.bind(this);
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    });

    if (envStore.data.stripe_public_key) {
      this.fetchSubscriptionInfo();
      fetchProducts().then((data)=> {
        this.setState({
          products: data.results,
        })
      })
    }
    this.fetchDataUsage();
  }

  private toggleComparison(){
    this.setState({
      expandComparison: !this.state.expandComparison,
    })
  }

  private setInterval(interval: string) {
    this.setState({
      intervalFilter: interval,
    })
    this.setState({
      filterToggle: !this.state.filterToggle,
    })
  }

  private filterPrices(){
    const filteredPrice = 
      this.state.products.map((product) => {
        return {
          ...product,
          prices: product.prices.filter((price) => price.interval === this.state.intervalFilter)
        }
    })
    console.log('prod filter', this.state.products)
    return filteredPrice;
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

  private upgradePlan(){
    // $.ajax({
    //   dataType: 'json',
    //   method: 'GET',
    //   url: `${ROOT_URL}/api/v2/stripe/checkout-link`,
    // })
    //   .done(this.onFetchSubscriptionInfoDone.bind(this))
    //   .fail(handleApiFail);

    //
    // -----
    // api/v2/stripe/checkout-link
    // - required parameter: price_id (string)    : product.prices[0].id
    // - optional parameter: organization_uid (string or null)  : 

    // api/v2/stripe/customer-portal
    // - required parameter: organization_uid (string)

    // Both endpoints return the same object if successful, {url: 'https://placeholder.com/'}
  }

  private onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    this.setState({
      subscribedProduct: response.results[0].plan.product,
    });
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

  private renderPlanText() {
    return (
      <bem.AccountPlan__description>
          {this.state.subscribedProduct.name}
      </bem.AccountPlan__description>
    );
  }

  render() {
      return (
        <bem.AccountPlan>
          <bem.AccountPlan__info>
            {this.renderPlanText()}
          </bem.AccountPlan__info>

          <bem.AccountPlan__stripe>
            {envStore.isReady && this.state.products.length !== 0 && (
            <div className='plans-section'>
              <form className="interval-toggle">
                <input
                  type="radio"
                  id="switch_left"
                  name="switchToggle"
                  value="year"
                  onChange={() => this.setInterval("year")}
                  checked={!this.state.filterToggle}
                />
                <label htmlFor="switch_left">Annual</label>

                <input
                  type="radio"
                  id="switch_right"
                  name="switchToggle"
                  value="month"
                  onChange={() => this.setInterval("month")}
                  checked={this.state.filterToggle}
                />
                <label htmlFor="switch_right">Monthly</label>
              </form>
              <div className='current-plan'>
                your plan
              </div>
              {/* api/v2/stripe/checkout-link */}
              {this.filterPrices().map((product, i) => {  
                return (
                  <div className='plan-container' key={i}>
                    <h1> {product.name} </h1>
                    {console.log(product, product.prices.length)}
                    {product.prices.length > 0 && (
                      <div>
                        <h2>
                        {console.log('test', product.prices[0].id)} 
                        {product.prices[0].amount === '0' ? 'Free' : product.prices[0]}
                        </h2>
                      </div>
                    )}
                    <ul>
                      <li>  <span className='checkmark'>
                      <div className='checkmark_stem' />
                      <div className='checkmark_kick' />
                    </span> 
                    features</li>
                    </ul>
                    {this.state.subscribedProduct.name !== product.name && 
                      <div className='upgrade-btn'> Upgrade </div>
                    }
                    <p key={i}>{product.description}</p>                   
                    {this.state.expandComparison &&
                    <div>
                    <div className='line'/>
                    <div className="x"/>
                    <p> Support </p>
                    <p> Advanced Features</p>
                    <p> Available add-ons </p>
                    </div>
                    }
                  </div>
                ) 
              })}
              <div className='enterprise-plan'>
                <h3> Need More?</h3>
                <p>
                We offer add-on options to increase your limits or the capacity of certain features for a period of time. Scroll down to learn more and purchase add-ons.</p>
                <p>If your organization has larger or more specific needs, contact our team to learn about our enterprise options.
                </p>
                <div>Get in touch for Enterprise options</div>
              </div>
              </div>
            )}
            <div className='expand-btn' onClick={() => this.toggleComparison()}> {!this.state.expandComparison ? 'Display Full Comparison' : 'Collapse'}</div>
          </bem.AccountPlan__stripe>
        </bem.AccountPlan>
      );
  }
}

export default observer(PlanRoute);
