import React from 'react';
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import {observer} from 'mobx-react';
import type {SubscriptionInfo, BaseProduct, Product } from './subscriptionStore';
import { fetchProducts } from './subscriptionStore';
import type {ServiceUsage} from './dataUsageStore';
import {handleApiFail} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import './planRoute.scss';
import {setState} from "reflux";

/**
 * TODO: Most probably all different Account routes will use very similar design,
 * so it would only make sense to define a very generic and reusable BEMs.
 *
 * See: https://www.figma.com/file/dyA3ivXUxmSjjFruqmW4T4/Data-storage-and-billing-options
 */
bem.AccountPlan = makeBem(null, 'account-plan');

// Plan details parent div
bem.AccountPlan__info = makeBem(bem.AccountPlan, 'info');
// Plan text description
bem.AccountPlan__description = makeBem(bem.AccountPlan, 'description');

// Stripe table parent div
bem.AccountPlan__stripe = makeBem(bem.AccountPlan, 'stripe');

const PLACEHOLDER_TITLE = t('Community plan');
const PLACEHOLDER_DESC = t('Free access to all services. 5GB of media attachments per account, 10,000 submissions per month, as well as 25 minutes of automatic speech recognition and 20,000 characters of machine translation per month.');

interface Organization {
  uid: string;
  name: string;
  is_active: boolean;
  created: string;
  modified:string;
  slug: string;
}

interface PlanRouteState {
  isLoading: boolean;
  subscribedProduct: BaseProduct;
  products: Product[];
  dataUsageBytes: number;
  dataUsageMonthly: number;
  intervalFilter: string;
  filterToggle: boolean;
  expandComparison: boolean;
  // TODO: Find/implement Organization interface
  organization: null|Organization;
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
      organization: null,
    };
    this.setInterval = this.setInterval.bind(this);
    this.filterPrices = this.filterPrices.bind(this);
    this.upgradePlan = this.upgradePlan.bind(this);
    this.fetchOrganization = this.fetchOrganization.bind(this);
    this.isSubscribedProduct = this.isSubscribedProduct.bind(this);
    this.managePlan = this.managePlan.bind(this);
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    });

    if (envStore.data.stripe_public_key) {
      this.fetchSubscriptionInfo();
      this.fetchOrganization();
      fetchProducts().then((data)=> {

        const renamedPriceKeys: any =
        data.results.map((product) => {
          let priceArry ={};
          Object.entries(product.prices[0]).forEach(entry => {
            let [key, value] = entry;
            const newKey = key.toLowerCase().replace(/[-_][a-z]/g, (group) => group.slice(-1).toUpperCase())
            Object.assign(priceArry, {[newKey]: value});
          })
          return {
            ...product,
            prices: priceArry
          }
        })

        this.setState({
          products: renamedPriceKeys,
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
      this.state.products.map((product: any) => {
        const interval = product.prices.humanReadablePrice.split('/')[1]
        const asArray = Object.entries(product.prices);
        const filtered = asArray.filter(() => interval === this.state.intervalFilter);
        return {
          ...product,
          prices: Object.fromEntries(filtered)
        }
    })
    return filteredPrice;
  }

  private isSubscribedProduct(product:any) {
    return product.name === this.state.subscribedProduct?.name;
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

  private upgradePlan(priceId:string) {
    console.log('Upgrade', priceId)
    $.ajax({
      dataType: 'json',
      method: 'POST',
      url: `${ROOT_URL}/api/v2/stripe/checkout-link?price_id=${priceId}&organization_uid=${this.state.organization?.uid}`
    })
      .done(function (res) {
        window.location.replace(res.url);
      })
      .fail(handleApiFail);
  }

  private managePlan() {
    console.log('Manage', this.state.organization?.uid)
    $.ajax({
      dataType: 'json',
      method: 'POST',
      url: `${ROOT_URL}/api/v2/stripe/customer-portal?organization_uid=${this.state.organization?.uid}`
    })
      .done(function (res) {
        window.location.replace(res.url);
      })
      .fail(handleApiFail);
  }

  private fetchOrganization() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/organizations/`,
    })
      .done(this.onFetchOrganizationDone.bind(this))
      .fail(handleApiFail);
  }

  private onFetchOrganizationDone(
    response: PaginatedResponse<Organization>
  ) {
    this.setState((prevState:PlanRouteState) => {
        return {
          ...prevState,
          organization: response.results[0]
        }
    });
  }

  private onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    if( response.results[0]?.plan.product ) {
      this.setState({
        subscribedProduct: response.results[0]?.plan.product,
      });
    }
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
          {this.state.subscribedProduct?.name}
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
              <div className='current-plan' style={{gridRow: 0, gridColumn: 1 + this.filterPrices().findIndex(this.isSubscribedProduct)}}>
                Your Plan
              </div>
              {this.filterPrices().map((product, i) => {
                return (
                  <div className='plan-container' key={i}>
                    <h1> {product.name} </h1>
                    {Object.keys(product.prices).length >= 0 && (
                      <div className='price-title'>
                          {typeof product.prices.humanReadablePrice === 'string' && (
                            product.prices.humanReadablePrice.includes('$0.00') ? 'Free' : product.prices.humanReadablePrice
                          )}
                      </div>
                    )}
                    <ul>
                      <li>
                      <span className='checkmark'>
                        <div className='checkmark_stem' />
                        <div className='checkmark_kick' />
                      </span>
                    features</li>
                    </ul>
                    {!this.isSubscribedProduct(product) &&
                      <div className='upgrade-btn' onClick={() => this.upgradePlan(product.prices.id)}> Upgrade</div>
                    }
                    {this.isSubscribedProduct(product) && this.state.organization?.uid &&
                      <div className='manage-btn' onClick={this.managePlan}> Manage</div>
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
