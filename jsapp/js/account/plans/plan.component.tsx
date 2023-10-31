import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import styles from './plan.module.scss';
import {
  getOrganization,
  getProducts,
  postCheckout,
  postCustomerPortal,
} from '../stripe.api';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import classnames from 'classnames';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {notify} from 'js/utils';
import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import type {FreeTierThresholds} from 'js/envStore';
import envStore from 'js/envStore';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import useWhen from 'js/hooks/useWhen.hook';
import AddOnList from 'js/account/plans/addOnList.component';
import subscriptionStore from 'js/account/subscriptionStore';
import {when} from 'mobx';
import {processCheckoutResponse} from 'js/account/stripe.utils';
import type {
  BasePrice,
  Organization,
  Price,
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import PlanButton from 'js/account/plans/planButton.component';

interface PlanState {
  subscribedProduct: null | SubscriptionInfo[];
  intervalFilter: string;
  filterToggle: boolean;
  products: null | Product[];
  organization: null | Organization;
  featureTypes: string[];
}

// An interface for our action
type DataUpdates =
  | {
      type: 'initialProd';
      prodData: Product[];
    }
  | {
      type: 'initialSub';
      prodData: SubscriptionInfo[];
    }
  | {
      type: 'initialOrg';
      prodData: Organization;
    }
  | {
      type: 'month' | 'year';
    };

interface FreeTierOverride extends FreeTierThresholds {
  name: string | null;
  [key: `feature_list_${number}`]: string | null;
}

const initialState: PlanState = {
  subscribedProduct: null,
  intervalFilter: 'month',
  filterToggle: true,
  products: null,
  organization: null,
  featureTypes: ['advanced', 'support', 'addons'],
};

const subscriptionUpgradeMessageDuration = 8000;

function planReducer(state: PlanState, action: DataUpdates): PlanState {
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
  // useReducer type defs incorrectly require an initializer arg - see https://github.com/facebook/react/issues/27052
  const [state, dispatch]: [PlanState, (arg: DataUpdates) => void] = useReducer(
    planReducer,
    initialState
  );
  const [expandComparison, setExpandComparison] = useState(false);
  const [isBusy, setIsBusy] = useState(true);
  const [shouldRevalidate, setShouldRevalidate] = useState(false);
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    SubscriptionInfo[]
  >([]);
  const [searchParams] = useSearchParams();
  const didMount = useRef(false);
  const navigate = useNavigate();

  const isDataLoading = useMemo(
    (): boolean =>
      !(state.products && state.organization && state.subscribedProduct),
    [state.products, state.organization, state.subscribedProduct]
  );

  const hasManageableStatus = useCallback(
    (subscription: SubscriptionInfo) =>
      ACTIVE_STRIPE_STATUSES.includes(subscription.status),
    []
  );

  const freeTierOverride = useMemo((): FreeTierOverride | null => {
    if (envStore.isReady) {
      const thresholds = envStore.data.free_tier_thresholds;
      const display = envStore.data.free_tier_display;
      const featureList: {[key: string]: string | null} = {};

      display.feature_list.forEach((feature, key) => {
        featureList[`feature_list_${key + 1}`] = feature;
      });

      return {
        name: display.name,
        ...thresholds,
        ...featureList,
      };
    }
    return null;
  }, [envStore.isReady]);

  const hasActiveSubscription = useMemo(() => {
    if (state.subscribedProduct) {
      return state.subscribedProduct.some((subscription: SubscriptionInfo) =>
        hasManageableStatus(subscription)
      );
    }
    return false;
  }, [state.subscribedProduct]);

  useMemo(() => {
    if (state.subscribedProduct && state.subscribedProduct.length > 0) {
      const subscribedFilter =
        state.subscribedProduct[0].items[0].price.recurring?.interval;
      if (subscribedFilter && hasManageableStatus(state.subscribedProduct[0])) {
        dispatch({type: subscribedFilter});
      }
    }
  }, [state.subscribedProduct]);

  useWhen(
    () => envStore.isReady,
    () => {
      // If Stripe isn't active, just redirect to the account page
      if (!envStore.data.stripe_public_key) {
        navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
        return;
      }
      const fetchPromises = [];

      if (
        shouldRevalidate ||
        !subscriptionStore.isInitialised ||
        !subscriptionStore.isPending
      ) {
        subscriptionStore.fetchSubscriptionInfo();
      }

      fetchPromises[0] = getProducts().then((data) => {
        // If we have no products, redirect
        if (!data.count) {
          navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
        }
        dispatch({
          type: 'initialProd',
          prodData: data.results,
        });
      });
      fetchPromises[1] = getOrganization().then((data) => {
        dispatch({
          type: 'initialOrg',
          prodData: data.results[0],
        });
      });
      fetchPromises[2] = when(() => subscriptionStore.isInitialised).then(
        () => {
          dispatch({
            type: 'initialSub',
            prodData: subscriptionStore.planResponse,
          });
          setActiveSubscriptions(subscriptionStore.activeSubscriptions);
        }
      );
      Promise.all(fetchPromises).then(() => {
        setIsBusy(false);
      });
    },
    [searchParams, shouldRevalidate]
  );

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
      const isSubscriptionUpdated = false;
      if (state.subscribedProduct) {
        state.subscribedProduct.find((subscription: SubscriptionInfo) =>
          subscription.items.find((item) => item.price.id === priceId)
        );
      }
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
      const filterAmount = state.products.map((product: Product): Price => {
        const filteredPrices = product.prices.filter((price: BasePrice) => {
          const interval = price.recurring?.interval;
          return (
            interval === state.intervalFilter &&
            product.metadata.product_type === 'plan'
          );
        });

        return {
          ...product,
          prices: filteredPrices[0],
        };
      });

      return filterAmount.filter((price) => price.prices);
    }
    return [];
  }, [state.products, state.intervalFilter]);

  const getSubscriptionsForProductId = useCallback(
    (productId: String) => {
      if (state.subscribedProduct) {
        return state.subscribedProduct.filter(
          (subscription: SubscriptionInfo) =>
            subscription.items[0].price.product.id === productId
        );
      }
      return null;
    },
    [state.subscribedProduct]
  );

  const isSubscribedProduct = useCallback(
    (product: Price) => {
      if (!product.prices?.unit_amount && !hasActiveSubscription) {
        return true;
      }

      const subscriptions = getSubscriptionsForProductId(product.id);

      if (subscriptions && subscriptions.length > 0) {
        return subscriptions.some(
          (subscription: SubscriptionInfo) =>
            subscription.items[0].price.id === product.prices.id &&
            hasManageableStatus(subscription)
        );
      }
      return false;
    },
    [state.subscribedProduct, state.intervalFilter, state.products]
  );

  const shouldShowManage = useCallback(
    (product: Price) => {
      const subscriptions = getSubscriptionsForProductId(product.id);
      if (!subscriptions || !subscriptions.length || !state.organization?.id) {
        return false;
      }

      return subscriptions.some((subscription: SubscriptionInfo) =>
        hasManageableStatus(subscription)
      );
    },
    [state.subscribedProduct, state.organization, state.products]
  );

  const upgradePlan = (price: BasePrice) => {
    if (!price.id || isBusy || !state.organization?.id) {
      return;
    }
    setIsBusy(true);
    if (activeSubscriptions.length) {
      // if the user has active subscriptions, send them to the customer portal to change to the new price
      postCustomerPortal(state.organization.id, price.id)
        .then(processCheckoutResponse)
        .catch(() => setIsBusy(false));
    } else {
      // just send the user to the checkout page
      postCheckout(price.id, state.organization.id)
        .then(processCheckoutResponse)
        .catch(() => setIsBusy(false));
    }
  };

  const managePlan = () => {
    if (!state.organization?.id || isBusy) {
      return;
    }
    setIsBusy(true);
    postCustomerPortal(state.organization.id)
      .then(processCheckoutResponse)
      .catch(() => setIsBusy(false));
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

  const getFeatureMetadata = (price: Price, featureItem: string) => {
    if (
      price.prices.unit_amount === 0 &&
      freeTierOverride &&
      freeTierOverride.hasOwnProperty(featureItem)
    ) {
      return freeTierOverride[featureItem as keyof FreeTierOverride];
    }
    return price.prices.metadata?.[featureItem] || price.metadata[featureItem];
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
    <div key={title}>
      <h2 className={styles.listTitle}>{title} </h2>
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
      if (listItem.icon && name === 'Professional') {
        items.push({icon: 'positive_pro', label: listItem.item});
      } else if (!listItem.icon) {
        items.push({icon: 'negative', label: listItem.item});
      } else {
        items.push({icon: 'positive', label: listItem.item});
      }
    });
    return renderFeaturesList(items, featureTitle);
  };

  if (!state.products?.length) {
    return null;
  }

  return (
    <>
      {isDataLoading ? (
        <LoadingSpinner />
      ) : (
        <div
          className={classnames(styles.accountPlan, {
            [styles.wait]: isBusy,
          })}
        >
          <div className={styles.plansSection}>
            <form className={styles.intervalToggle}>
              <input
                type='radio'
                id='switch_left'
                name='switchToggle'
                value='month'
                aria-label={'Toggle to month options'}
                onChange={() => dispatch({type: 'month'})}
                checked={state.filterToggle}
              />
              <label htmlFor='switch_left'> {t('Monthly')}</label>

              <input
                type='radio'
                id='switch_right'
                name='switchToggle'
                value='year'
                onChange={() => dispatch({type: 'year'})}
                checked={!state.filterToggle}
                aria-label={'Toggle to annual options'}
              />
              <label htmlFor='switch_right'>{t('Annual')}</label>
            </form>

            <div className={styles.allPlans}>
              {filterPrices.map((price: Price) => (
                <div className={styles.stripePlans} key={price.id}>
                  {isSubscribedProduct(price) ? (
                    <div className={styles.currentPlan}>{t('Your plan')}</div>
                  ) : (
                    <div />
                  )}
                  <div
                    className={classnames({
                      [styles.planContainerWithBadge]:
                        isSubscribedProduct(price),
                      [styles.planContainer]: true,
                    })}
                  >
                    <h1 className={styles.priceName}>
                      {price.prices?.unit_amount
                        ? price.name
                        : freeTierOverride?.name || price.name}
                    </h1>
                    <div className={styles.priceTitle}>
                      {!price.prices?.unit_amount
                        ? t('Free')
                        : price.prices?.recurring?.interval === 'year'
                        ? `$${(price.prices?.unit_amount / 100 / 12).toFixed(
                            2
                          )} USD/month`
                        : price.prices.human_readable_price}
                    </div>
                    <ul className={styles.featureContainer}>
                      {Object.keys(price.metadata).map(
                        (featureItem: string) =>
                          featureItem.includes('feature_list_') && (
                            <li key={featureItem}>
                              <div className={styles.iconContainer}>
                                <Icon
                                  name='check'
                                  size='m'
                                  color={
                                    price.name === 'Professional'
                                      ? 'teal'
                                      : 'storm'
                                  }
                                />
                              </div>
                              {getFeatureMetadata(price, featureItem)}
                            </li>
                          )
                      )}
                    </ul>
                    {expandComparison && (
                      <div className={styles.expandedContainer}>
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
                      </div>
                    )}
                    {!isSubscribedProduct(price) &&
                      !shouldShowManage(price) &&
                      price.prices.unit_amount > 0 && (
                        <PlanButton
                          label={t('Upgrade')}
                          onClick={() => upgradePlan(price.prices)}
                          aria-label={`upgrade to ${price.name}`}
                          aria-disabled={isBusy}
                          isDisabled={isBusy}
                        />
                      )}
                    {isSubscribedProduct(price) &&
                      shouldShowManage(price) &&
                      price.prices.unit_amount > 0 && (
                        <PlanButton
                          label={t('Manage')}
                          onClick={managePlan}
                          aria-label={`manage your ${price.name} subscription`}
                          aria-disabled={isBusy}
                          isDisabled={isBusy}
                        />
                      )}
                    {!isSubscribedProduct(price) &&
                      shouldShowManage(price) &&
                      price.prices.unit_amount > 0 && (
                        <PlanButton
                          label={t('Change plan')}
                          onClick={managePlan}
                          aria-label={`change your subscription to ${price.name}`}
                          aria-disabled={isBusy}
                          isDisabled={isBusy}
                        />
                      )}
                    {price.prices.unit_amount === 0 && (
                      <div className={styles.btnSpacePlaceholder} />
                    )}
                  </div>
                </div>
              ))}

              <div className={styles.enterprisePlanContainer}>
                <div className={styles.enterprisePlan}>
                  <h1 className={styles.enterpriseTitle}> {t('Want more?')}</h1>
                  <div className={styles.priceTitle}>{t('Contact us')}</div>
                  <p className={styles.enterpriseDetails}>
                    {t(
                      'For organizations with higher volume and advanced data collection needs, get in touch to learn more about our '
                    )}
                    <a
                      href='https://www.kobotoolbox.org/contact/'
                      target='_blanks'
                      className={styles.enterpriseLink}
                    >
                      {t('Enterprise Plan')}
                    </a>
                    .
                  </p>
                  <p className={styles.enterpriseDetails}>
                    {t(
                      'We also offer custom solutions and private servers for large organizations. '
                    )}
                    <br />
                    <a
                      href='https://www.kobotoolbox.org/contact/'
                      target='_blanks'
                      className={styles.enterpriseLink}
                    >
                      {t('Contact our team')}
                    </a>
                    {t(' for more information.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {hasMetaFeatures() && (
            <div>
              <Button
                type='full'
                color='cloud'
                size='m'
                isFullWidth
                label={
                  expandComparison
                    ? t('Collapse full comparison')
                    : t('Display full comparison')
                }
                onClick={() => setExpandComparison(!expandComparison)}
                aria-label={
                  expandComparison
                    ? t('Collapse full comparison')
                    : t('Display full comparison')
                }
              />
            </div>
          )}
          <AddOnList
            isBusy={isBusy}
            setIsBusy={setIsBusy}
            products={state.products}
            organization={state.organization}
          />
        </div>
      )}
    </>
  );
}
