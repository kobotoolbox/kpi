import React, {useEffect, useReducer, useState} from 'react';
import styles from './plan.module.scss';
import {
  getOrganization,
  getProducts,
  getSubscription,
  Product,
  Organization,
  BaseSubscription,
  postCheckout,
  postCustomerPortal,
} from './stripe.api';
import Icon from '../components/common/icon';
import {ROOT_URL} from 'js/constants';

interface PlanState {
  isLoading: boolean;
  subscribedProduct: BaseSubscription;
  intervalFilter: string;
  filterToggle: boolean;
  products: Product[];
  organization: null | Organization;
}

// An interface for our action
interface dataUpdates {
  type: string;
  prodData: any;
}

const initialState = {
  isLoading: true,
  subscribedProduct: [],
  intervalFilter: 'year',
  filterToggle: false,
  products: [],
  organization: null,
};

function planReducer(state: PlanState, action: dataUpdates) {
  switch (action.type) {
    case 'initialProd':
      return {...state, products: action.prodData};
    case 'initialOrg':
      return {...state, organization: action.prodData};
    case 'initialSub':
      return {...state, subscribedProduct: action.prodData};
    case 'month':
      return {
        ...state,
        intervalFilter: 'month',
        filterToggle: !state.filterToggle,
      };
    case 'year':
      return {
        ...state,
        intervalFilter: 'year',
        filterToggle: !state.filterToggle,
      };
    default:
      return state;
  }
}

export default function Plan() {
  const [state, dispatch] = useReducer(planReducer, initialState);
  const [expandComparison, setExpandComparison] = useState(false);
  const [buttonsDisabled, setButtonDisabled] = useState(false);
  const [showExpand, setShowExpand] = useState(false);

  useEffect(() => {
    getProducts().then((data) => {
      dispatch({
        type: 'initialProd',
        prodData: data.results,
      });
    });

    getOrganization().then((data) => {
      console.log('org', data);

      dispatch({
        type: 'initialOrg',
        prodData: data.results[0],
      });
    });

    getSubscription().then((data) => {
      console.log('sub', data);
      dispatch({
        type: 'initialSub',
        prodData: data.results,
      });
    });
  }, []);

  useEffect(() => {
    checkMetaFeatures();
  }, [state.products]);

  // Filter prices based on plan interval
  const filterPrices = () => {
    if (state.products.length > 0) {
      const filterAmount = state.products.map((product: any) => {
        const filteredPrices = product.prices.filter((price: any) => {
          const interval = price.human_readable_price.split('/')[1];
          return interval === state.intervalFilter || price.unit_amount === 0;
        });
        return {
          ...product,
          prices: filteredPrices.length ? filteredPrices[0] : null,
        };
      });
      return filterAmount.filter((product: any) => product.prices);
    }
  };

  const isSubscribedProduct = (product: Product) => {
    if( product.prices.unit_amount === 0 && !state.subscribedProduct?.length ) {
      return true;
    }
    return product.name === state.subscribedProduct?.name;  };
  };

  const upgradePlan = (priceId: string) => {
    if (!priceId || buttonsDisabled) {
      return;
    }
    setButtonDisabled(buttonsDisabled);
    postCheckout(priceId, state.organization?.uid)
      .then((data) => {
        window.location.assign(data.url);
      })
      .finally(() => setButtonDisabled(!buttonsDisabled));
  };

  const managePlan = () => {
    if (!state.organization?.uid || buttonsDisabled) {
      return;
    }
    setButtonDisabled(buttonsDisabled);
    postCustomerPortal(state.organization?.uid)
      .then((data) => {
        window.location.assign(data.url);
      })
      .finally(() => setButtonDisabled(!buttonsDisabled));
  };

  // Get feature items and matching icon boolean
  const getListItem = (listType: string, plan: string) => {
    const listItems: {icon: boolean; item: any}[] = [];
    filterPrices().map((price: any) =>
      Object.keys(price.metadata).map((featureItem: any) => {
        const numberItem = featureItem.lastIndexOf('_');
        const currentResult = featureItem.substring(numberItem + 1);

        const currentIcon = `feature_${listType}_check_${currentResult}`;
        if (
          featureItem.includes(`feature_${listType}_`) &&
          !featureItem.includes(`feature_${listType}_check`) &&
          price.name === plan
        ) {
          const keyName = `feature_${listType}_${currentResult}`;
          let iconBool = false;
          const itemName: string = price.metadata[keyName];
          if (price.metadata[currentIcon] !== undefined) {
            iconBool = JSON.parse(price.metadata[currentIcon]);
            listItems.push({icon: iconBool, item: itemName});
          }
        }
      })
    );
    return listItems;
  };

  const checkMetaFeatures = () => {
    console.log('len', state.products);
    if (state.products.length > 0) {
      filterPrices().map((price: any) =>
        Object.keys(price.metadata).map((featureItem: any) => {
          if (
            featureItem.includes(`feature_support_`) ||
            featureItem.includes(`feature_advanced_`) ||
            featureItem.includes(`feature_addon_`)
          ) {
            setShowExpand(true);
          } else {
            setShowExpand(false);
          }
        })
      );
    }
  };

  return (
    <div className={styles.accountPlan}>
      {state.products.length > 0 && (
        <div className={styles.plansSection}>
          <form className={styles.intervalToggle}>
            <input
              type='radio'
              id='switch_left'
              name='switchToggle'
              value='year'
              onChange={() => dispatch({type: 'year', prodData: {}})}
              checked={!state.filterToggle}
            />
            <label htmlFor='switch_left'>Annual</label>

            <input
              type='radio'
              id='switch_right'
              name='switchToggle'
              value='month'
              onChange={() => dispatch({type: 'month', prodData: {}})}
              checked={state.filterToggle}
            />
            <label htmlFor='switch_right'>Monthly</label>
          </form>
          <div
            className={styles.currentPlan}
            style={{
              gridRow: 0,
              gridColumn: 1 + filterPrices().findIndex(isSubscribedProduct),
              display:
                filterPrices().findIndex(isSubscribedProduct) >= 0
                  ? ''
                  : 'none',
            }}
          >
            Your Plan
          </div>
          {filterPrices().map((price: any, i: number) => (
            <div className={styles.planContainer} key={i}>
              <h1 className={styles.priceName}> {price.name} </h1>
              <div className={styles.priceTitle}>
                {typeof price.prices.human_readable_price === 'string' &&
                  (price.prices.human_readable_price.includes('$0.00')
                    ? 'Free'
                    : price.prices.human_readable_price)}
              </div>

              <ul>
                {Object.keys(price.metadata).map(
                  (featureItem: any) =>
                    featureItem.includes('feature_list_') && (
                      <li key={featureItem}>
                        <div className={styles.iconContainer}>
                          <Icon name='check' size='m' />
                        </div>
                        {price.metadata[featureItem]}
                      </li>
                    )
                )}
              </ul>
              {!isSubscribedProduct(price) && (
                <button
                  className={[styles.resetButton, styles.upgradeBtn].join(' ')}
                  onClick={() => upgradePlan(price.prices.id)}
                  aria-label={`upgrade to ${price.name}`}
                  disabled={buttonsDisabled}
                  aria-disabled={buttonsDisabled}
                >
                  Upgrade
                </button>
              )}
              {isSubscribedProduct(price) && state.organization?.uid && (
                <button
                  className={[styles.resetButton, styles.manageBtn].join(' ')}
                  onClick={managePlan}
                  disabled={buttonsDisabled}
                  aria-disabled={buttonsDisabled}
                  aria-label={`manage your ${price.name} subscription`}
                >
                  Manage
                </button>
              )}
              {expandComparison && (
                <div>
                  <div className={styles.line} />
                  {getListItem('support', price.name).length > 0 && (
                    <ul>
                      <li className={styles.listTitle}>
                        {price.metadata.feature_support_title}
                      </li>
                      {getListItem('support', price.name).map((listItem) =>
                        listItem.icon ? (
                          listItem.icon === true && (
                            <li key={listItem.item}>
                              <div className={styles.iconContainer}>
                                <Icon name='check' size='m' />
                              </div>
                              {listItem.item}
                            </li>
                          )
                        ) : (
                          <li key={listItem.item}>
                            <div className={styles.iconContainer}>
                              <Icon name='close' size='m' />
                            </div>
                            {listItem.item}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                  {getListItem('advanced', price.name).length > 0 && (
                    <ul>
                      <li className={styles.listTitle}>
                        {price.metadata.feature_advanced_title}
                      </li>
                      {getListItem('advanced', price.name).map((listItem) =>
                        listItem.icon ? (
                          listItem.icon === true && (
                            <li key={listItem.item}>
                              <div className={styles.iconContainer}>
                                <Icon name='check' size='m' />
                              </div>
                              {listItem.item}
                            </li>
                          )
                        ) : (
                          <li key={listItem.item}>
                            <div className={styles.iconContainer}>
                              <Icon name='close' size='m' />
                            </div>
                            {listItem.item}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                  {getListItem('addons', price.name).length > 0 && (
                    <ul>
                      <li className={styles.listTitle}>
                        {price.metadata.feature_addons_title}
                      </li>
                      {getListItem('addons', price.name).map((listItem) =>
                        listItem.icon ? (
                          listItem.icon === true && (
                            <li key={listItem.item}>
                              <div className={styles.iconContainer}>
                                <Icon name='check' size='m' />
                              </div>
                              {listItem.item}
                            </li>
                          )
                        ) : (
                          <li key={listItem.item}>
                            <div className={styles.iconContainer}>
                              <Icon name='close' size='m' />
                            </div>
                            {listItem.item}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className={styles.enterprisePlan}>
            <h1 className={styles.enterpriseTitle}> Need More?</h1>
            <p className={styles.enterpriseDetails}>
              We offer add-on options to increase your limits or the capacity of
              certain features for a period of time. Scroll down to learn more
              and purchase add-ons.
            </p>
            <p className={styles.enterpriseDetails}>
              If your organization has larger or more specific needs, contact
              our team to learn about our enterprise options.
            </p>
            <div className={styles.enterpriseLink}>
              <a href='https://www.kobotoolbox.org/contact/' target='_blanks'>
                Get in touch for Enterprise options
              </a>
            </div>
          </div>
        </div>
      )}
      {showExpand && (
        <div
          className={styles.expandBtn}
          role='button'
          onClick={() => setExpandComparison(!expandComparison)}
        >
          {' '}
          {expandComparison ? 'Collapse' : 'Display Full Comparison'}
        </div>
      )}
    </div>
  );
}
