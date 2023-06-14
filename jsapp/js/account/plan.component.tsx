import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {useSearchParams} from 'react-router-dom';
import styles from './plan.module.scss';
import type {
  BaseSubscription,
  Product,
  Organization,
  BasePrice,
  Price,
} from './stripe.api';
import {
  getOrganization,
  getProducts,
  getSubscription,
  postCheckout,
  postCustomerPortal,
} from './stripe.api';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import classnames from 'classnames';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {notify} from 'js/utils';
import {BaseProduct} from "js/account/subscriptionStore";

interface PlanState {
  subscribedProduct: null | BaseSubscription;
  intervalFilter: string;
  filterToggle: boolean;
  products: null | Product[];
  organization: null | Organization;
  featureTypes: string[];
}

// An interface for our action
interface DataUpdates {
  type: string;
  prodData?: any;
}

const initialState = {
  subscribedProduct: null,
  intervalFilter: 'year',
  filterToggle: false,
  products: null,
  organization: null,
  featureTypes: ['support', 'advanced', 'addons'],
};

/*
  Stripe Subscription statuses that are shown as active in the UI.
  Subscriptions with a status in this array will show an option to 'Manage'.
*/
const activeSubscriptionStatuses = ['active', 'past_due', 'trialing'];

const subscriptionUpgradeMessageDuration = 8000;

function planReducer(state: PlanState, action: DataUpdates) {
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
        filterToggle: true,
      };
    case 'year':
      return {
        ...state,
        intervalFilter: 'year',
        filterToggle: false,
      };
    default:
      return state;
  }
}

export default function Plan() {
  const [state, dispatch] = useReducer(planReducer, initialState);
  const [expandComparison, setExpandComparison] = useState(false);
  const [areButtonsDisabled, setAreButtonsDisabled] = useState(true);
  const [shouldRevalidate, setShouldRevalidate] = useState(false);
  const [searchParams] = useSearchParams();
  const didMount = useRef(false);

  const isDataLoading = useMemo(
    (): boolean =>
      !(state.products && state.organization && state.subscribedProduct),
    [state.products, state.organization, state.subscribedProduct]
  );

  const hasManageableStatus = useCallback((subscription: BaseSubscription) =>
    activeSubscriptionStatuses.includes(subscription.status), []);

  const hasActiveSubscription = useMemo(() => {
    if (state.subscribedProduct) {
      return state.subscribedProduct.some((subscription: BaseSubscription) =>
        hasManageableStatus(subscription)
      );
    }
    return false;
  }, [state.subscribedProduct]);

  useMemo(() => {
    if (
      state.subscribedProduct?.length > 0
    ) {
      const subscribedFilter =
        state.subscribedProduct?.[0].items[0].price.recurring?.interval;
      if (!hasManageableStatus(state.subscribedProduct)) {
        dispatch({type: 'year'});
      } else {
        dispatch({type: subscribedFilter});
      }
    }
  }, [state.subscribedProduct]);

  useEffect(() => {
    getProducts().then((data) => {
      dispatch({
        type: 'initialProd',
        prodData: data.results,
      });
    });

    getOrganization().then((data) => {
      dispatch({
        type: 'initialOrg',
        prodData: data.results[0],
      });
    });

    getSubscription().then((data) => {
      dispatch({
        type: 'initialSub',
        prodData: data.results,
      });
    });

    if (isDataLoading) {
      setAreButtonsDisabled(false);
    }
  }, [searchParams, shouldRevalidate]);

  // Re-fetch data from API and re-enable buttons if displaying from back/forward cache
  useEffect(() => {
    const handlePersisted = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setShouldRevalidate(!shouldRevalidate);
      }
    };
    window.addEventListener('pageshow', handlePersisted);
    return () => {
      window.removeEventListener('pageshow', handlePersisted);
    };
  }, []);

  useEffect(() => {
    // display a success message if we're returning from Stripe checkout
    // only run *after* first render
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const priceId = searchParams.get('checkout');
    if (priceId) {
      const isSubscriptionUpdated = state.subscribedProduct.find(
        (subscription: BaseSubscription) =>
          subscription.items.find((item) => item.price.id === priceId)
      );
      if (isSubscriptionUpdated) {
        notify.success(
          t(
            'Thanks for your upgrade! We appreciate your continued support. Reach out to billing@kobotoolbox.org if you have any questions about your plan.'
          ),
          {
            duration: subscriptionUpgradeMessageDuration,
          }
        );
      } else {
        notify.success(
          t(
            'Thanks for your upgrade! We appreciate your continued support. If your account is not immediately updated, wait a few minutes and refresh the page.'
          ),
          {
            duration: subscriptionUpgradeMessageDuration,
          }
        );
      }
    }
  }, [state.subscribedProduct]);

  // Filter prices based on plan interval and filter out recurring addons
  const filterPrices = useMemo((): Price[] => {
    if (state.products !== null) {
      const filterAmount = state.products.map((product: Product) => {
        const filteredPrices = product.prices.filter((price: BasePrice) => {
          const interval = price.recurring?.interval;
          return interval === state.intervalFilter && product.metadata.product_type === 'plan';
        });

        return {
          ...product,
          prices: filteredPrices?.[0],
        };
      });

      return filterAmount.filter((product: Product) => product.prices)
        .sort((priceA: Price, priceB: Price) => priceA.prices.unit_amount > priceB.prices.unit_amount);
    }
    return [];
  }, [state.products, state.intervalFilter]);

  const getSubscriptionsForProductId = useCallback(
    (productId: String) =>
      state.subscribedProduct.filter(
        (subscription: BaseSubscription) =>
          subscription.items[0].price.product.id === productId
      ),
    [state.subscribedProduct]
  );

  const isSubscribedProduct = useCallback(
    (product: Price) => {
      if (
        !product.prices.unit_amount &&
        state.intervalFilter === 'year' &&
        !hasActiveSubscription
      ) {
        return true;
      }

      const subscriptions = getSubscriptionsForProductId(product.id);

      if (subscriptions.length > 0) {
        return subscriptions.some((subscription: BaseSubscription) =>
          subscription.items[0].price.id === product.prices.id &&
          hasManageableStatus(subscription)
        );
      }
      return false;
    },
    [state.subscribedProduct, state.intervalFilter]
  );

  const shouldShowManage = useCallback(
    (product: Price) => {
      const subscriptions = getSubscriptionsForProductId(product.id);
      if (!subscriptions.length || !state.organization?.id) {
        return false;
      }

      return subscriptions.some((subscription: BaseSubscription) =>
          hasManageableStatus(subscription)
      );
    },
    [state.subscribedProduct]
  );

  const upgradePlan = (priceId: string) => {
    if (!priceId || areButtonsDisabled) {
      return;
    }
    setAreButtonsDisabled(true);
    postCheckout(priceId, state.organization?.id)
      .then((data) => {
        if (!data.url) {
          notify.error(t('There has been an issue, please try again later.'));
        } else {
          window.location.assign(data.url);
        }
      })
      .catch(() => setAreButtonsDisabled(false));
  };

  const managePlan = () => {
    if (!state.organization?.id || areButtonsDisabled) {
      return;
    }
    setAreButtonsDisabled(true);
    postCustomerPortal(state.organization.id)
      .then((data) => {
        if (!data.url) {
          notify.error(t('There has been an issue, please try again later.'));
        } else {
          window.location.assign(data.url);
        }
      })
      .catch(() => setAreButtonsDisabled(false));
  };

  // Get feature items and matching icon boolean
  const getListItem = (listType: string, plan: string) => {
    const listItems: Array<{icon: boolean; item: string}> = [];
    filterPrices.map((price) =>
      Object.keys(price.metadata).map((featureItem: string) => {
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
          const itemName: string =
            price.prices.metadata?.[keyName] || price.metadata[keyName];
          if (price.metadata[currentIcon] !== undefined) {
            iconBool = JSON.parse(price.metadata[currentIcon]);
            listItems.push({icon: iconBool, item: itemName});
          }
        }
      })
    );
    return listItems;
  };

  const hasMetaFeatures = () => {
    let expandBool = false;
    if (state.products && state.products.length > 0) {
      filterPrices.map((price) => {
        for (const featureItem in price.metadata) {
          if (
            featureItem.includes('feature_support_') ||
            featureItem.includes('feature_advanced_') ||
            featureItem.includes('feature_addon_')
          ) {
            expandBool = true;
            break;
          }
        }
      });
    }
    return expandBool;
  };

  useEffect(() => {
    hasMetaFeatures();
  }, [state.products]);

  const renderFeaturesList = (
    items: Array<{
      icon: 'positive' | 'positive_pro' | 'negative';
      label: string;
    }>,
    title?: string
  ) => (
    <div className={styles.expandedFeature} key={title}>
      <h2 className={styles.listTitle}>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <div className={styles.iconContainer}>
              {item.icon !== 'negative' ? (
                <Icon
                  name='check'
                  size='m'
                  color={item.icon === 'positive_pro' ? 'teal' : 'storm'}
                />
              ) : (
                <Icon name='close' size='m' color='red' />
              )}
            </div>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );

  const returnListItem = (type: string, name: string, featureTitle: string) => {
    const items: Array<{
      icon: 'positive' | 'positive_pro' | 'negative';
      label: string;
    }> = [];
    getListItem(type, name).map((listItem) => {
      if (listItem.icon && name === 'Professional plan') {
        items.push({icon: 'positive_pro', label: listItem.item});
      } else if (!listItem.icon) {
        items.push({icon: 'negative', label: listItem.item});
      } else {
        items.push({icon: 'positive', label: listItem.item});
      }
    });
    return renderFeaturesList(items, featureTitle);
  };
  if (state.products) {
    if (!state.products.length) {
      return null;
    }
  }

  return (
    <>
      {isDataLoading ? (
        <LoadingSpinner />
      ) : (
        <div
          className={classnames(styles.accountPlan, {
            [styles.wait]: areButtonsDisabled,
          })}
        >
          <div className={styles.plansSection}>
            <form className={styles.intervalToggle}>
              <input
                type='radio'
                id='switch_left'
                name='switchToggle'
                value='year'
                onChange={() => dispatch({type: 'year'})}
                checked={!state.filterToggle}
                aria-label={'Toggle to annual options'}
              />
              <label htmlFor='switch_left'>{t('Annual')}</label>

              <input
                type='radio'
                id='switch_right'
                name='switchToggle'
                value='month'
                aria-label={'Toggle to month options'}
                onChange={() => dispatch({type: 'month'})}
                checked={state.filterToggle}
              />
              <label htmlFor='switch_right'> {t('Monthly')}</label>
            </form>

            <div className={styles.allPlans}>
              {filterPrices.map((price: Price) => (
                <div className={styles.stripePlans} key={price.id}>
                  {isSubscribedProduct(price) ? (
                    <div className={styles.currentPlan}>{t('your plan')}</div>
                  ) : (
                    <div className={styles.otherPlanSpacing} />
                  )}
                  <div
                    className={classnames({
                      [styles.planContainerWithBadge]:
                        isSubscribedProduct(price),
                      [styles.planContainer]: true,
                    })}
                  >
                    <h1 className={styles.priceName}> {price.name} </h1>
                    <div className={styles.priceTitle}>
                      {!price.prices?.unit_amount
                        ? t('Free')
                        : price.prices.human_readable_price}
                    </div>

                    <ul>
                      {Object.keys(price.metadata).map(
                        (featureItem: string) =>
                          featureItem.includes('feature_list_') && (
                            <li key={featureItem}>
                              <div className={styles.iconContainer}>
                                <Icon
                                  name='check'
                                  size='m'
                                  color={
                                    price.name === 'Professional plan'
                                      ? 'teal'
                                      : 'storm'
                                  }
                                />
                              </div>
                              {price.prices.metadata?.[featureItem] ||
                                price.metadata[featureItem]}
                            </li>
                          )
                      )}
                    </ul>
                    {!isSubscribedProduct(price) &&
                      !shouldShowManage(price) &&
                      price.prices.unit_amount > 0 && (
                        <Button
                          type='full'
                          color='blue'
                          size='m'
                          label={t('Upgrade')}
                          onClick={() => upgradePlan(price.prices.id)}
                          aria-label={`upgrade to ${price.name}`}
                          aria-disabled={areButtonsDisabled}
                          isDisabled={areButtonsDisabled}
                        />
                      )}
                    {isSubscribedProduct(price) &&
                      shouldShowManage(price) &&
                      price.prices.unit_amount > 0 && (
                        <Button
                          type='full'
                          color='blue'
                          size='m'
                          label={t('Manage')}
                          onClick={managePlan}
                          aria-label={`manage your ${price.name} subscription`}
                          aria-disabled={areButtonsDisabled}
                          isDisabled={areButtonsDisabled}
                        />
                      )}
                    {!isSubscribedProduct(price) &&
                      shouldShowManage(price) &&
                      price.prices.unit_amount > 0 && (
                        <Button
                          type='full'
                          color='blue'
                          size='m'
                          label={t('Change plan')}
                          onClick={managePlan}
                          aria-label={`change your subscription to ${price.name}`}
                          aria-disabled={areButtonsDisabled}
                          isDisabled={areButtonsDisabled}
                        />
                      )}
                    {price.prices.unit_amount === 0 && (
                      <div className={styles.btnSpacePlaceholder} />
                    )}

                    {expandComparison && (
                      <>
                        <hr />
                        {state.featureTypes.map(
                          (type) =>
                            getListItem(type, price.name).length > 0 &&
                            returnListItem(
                              type,
                              price.name,
                              price.metadata[`feature_${type}_title`]
                            )
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              <div className={styles.enterprisePlanContainer}>
                <div className={styles.otherPlanSpacing} />
                <div className={styles.enterprisePlan}>
                  <h1 className={styles.enterpriseTitle}> {t('Need More?')}</h1>
                  <p className={styles.enterpriseDetails}>
                    {t(
                      'We offer several add-on options to increase your limits or the capacity of certain features for a period of time, depending on which plan you use.'
                    )}
                  </p>
                  <p className={styles.enterpriseDetails}>
                    {t(
                      'If your organization has larger or more specific needs, please contact our team to learn about our enterprise options.'
                    )}
                  </p>
                  <div className={styles.enterpriseLink}>
                    <a
                      href='https://www.kobotoolbox.org/contact/'
                      target='_blanks'
                    >
                      {t('Get in touch for Enterprise options')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hasMetaFeatures() && (
            <div className={styles.expandBtn}>
              <Button
                type='full'
                color='cloud'
                size='m'
                isFullWidth
                label={
                  expandComparison
                    ? t('Collapse')
                    : t('Display full comparison')
                }
                onClick={() => setExpandComparison(!expandComparison)}
                aria-label={
                  expandComparison
                    ? t('Collapse')
                    : t('Display full comparison')
                }
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
