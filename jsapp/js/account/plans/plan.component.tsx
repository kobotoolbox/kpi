import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import styles from './plan.module.scss';
import {getOrganization, postCheckout, postCustomerPortal} from '../stripe.api';
import Button from 'js/components/common/button';
import classnames from 'classnames';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {notify} from 'js/utils';
import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import type {FreeTierThresholds} from 'js/envStore';
import envStore from 'js/envStore';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import useWhen from 'js/hooks/useWhen.hook';
import AddOnList from 'js/account/add-ons/addOnList.component';
import subscriptionStore from 'js/account/subscriptionStore';
import {when} from 'mobx';
import {
  getSubscriptionsForProductId,
  isDowngrade,
  processCheckoutResponse,
} from 'js/account/stripe.utils';
import type {
  Price,
  Organization,
  Product,
  SubscriptionInfo,
  SinglePricedProduct,
} from 'js/account/stripe.types';
import type {ConfirmChangeProps} from 'js/account/plans/confirmChangeModal.component';
import ConfirmChangeModal from 'js/account/plans/confirmChangeModal.component';
import Session from 'js/stores/session';
import InlineMessage from 'js/components/common/inlineMessage';
import {PlanContainer} from 'js/account/plans/planContainer.component';
import {ProductsContext} from '../useProducts.hook';

export interface PlanState {
  subscribedProduct: null | SubscriptionInfo[];
  intervalFilter: string;
  filterToggle: boolean;
  organization: null | Organization;
  featureTypes: string[];
}

interface PlanProps {
  showAddOns?: boolean;
}

// An interface for our action
type DataUpdates =
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

export interface FreeTierOverride extends FreeTierThresholds {
  name: string | null;
  [key: `feature_list_${number}`]: string | null;
}

const initialState: PlanState = {
  subscribedProduct: null,
  intervalFilter: 'month',
  filterToggle: true,
  organization: null,
  featureTypes: ['advanced', 'support', 'addons'],
};

const subscriptionUpgradeMessageDuration = 8000;

function planReducer(state: PlanState, action: DataUpdates): PlanState {
  switch (action.type) {
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

export default function Plan(props: PlanProps) {
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
  const productsContext = useContext(ProductsContext);
  const [confirmModal, setConfirmModal] = useState<ConfirmChangeProps>({
    newPrice: null,
    products: [],
    currentSubscription: null,
    quantity: 1,
  });
  const [visiblePlanTypes, setVisiblePlanTypes] = useState(['default']);
  const [session, setSession] = useState(() => Session);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const [searchParams] = useSearchParams();
  const didMount = useRef(false);
  const navigate = useNavigate();
  const [showGoTop, setShowGoTop] = useState(false);
  const pageBody = useRef<HTMLDivElement>(null);

  const handleVisibleButton = () => {
    if (pageBody.current && pageBody.current.scrollTop > 300) {
      setShowGoTop(true);
    } else {
      setShowGoTop(false);
    }
  };

  const handleScrollUp = () => {
    pageBody.current?.scrollTo({left: 0, top: 0, behavior: 'smooth'});
  };

  useEffect(() => {
    pageBody.current?.addEventListener('scroll', handleVisibleButton);
  }, []);

  const isDataLoading = useMemo(
    (): boolean =>
      !(
        productsContext.isLoaded &&
        state.organization &&
        state.subscribedProduct
      ),
    [productsContext.isLoaded, state.organization, state.subscribedProduct]
  );

  const isDisabled = useMemo(
    () => isBusy || isUnauthorized,
    [isBusy, isUnauthorized]
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

  // if the user is currently subscribed to a plan, toggle the Monthly/Annual switch to match their plan
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

      if (!subscriptionStore.isInitialised || !subscriptionStore.isPending) {
        subscriptionStore.fetchSubscriptionInfo();
      }

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

  // we need to show a message and disable the page if the user is not the owner of their org
  useEffect(() => {
    if (
      state.organization &&
      state.organization.owner_username !== session.currentAccount.username
    ) {
      setIsUnauthorized(true);
    }
  }, [state.organization]);

  // Re-fetch data from API and re-enable buttons if displaying from back/forward cache
  useEffect(() => {
    const handlePersisted = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setShouldRevalidate((prevState) => !prevState);
      }
    };
    window.addEventListener('pageshow', handlePersisted);
    return () => {
      window.removeEventListener('pageshow', handlePersisted);
    };
  }, []);

  // display a success message if we're returning from Stripe checkout
  useEffect(() => {
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

  // get any plan types passed in the query string and make them visible
  // by default, only products without a `plan_type` metadata value will be shown
  useEffect(() => {
    const plansToShow = searchParams.get('type');
    // if the user is already on the enterprise plan, *only* show the enterprise plan(s)
    if (
      activeSubscriptions?.find(
        (sub) =>
          sub.items?.[0].price.product.metadata?.plan_type === 'enterprise'
      )
    ) {
      setVisiblePlanTypes(['enterprise']);
    } else if (plansToShow) {
      setVisiblePlanTypes(plansToShow.split(','));
    } else {
      setVisiblePlanTypes(['default']);
    }
  }, [searchParams, activeSubscriptions]);

  // should we show the 'Contact us' sidebar and storage add-ons?
  const shouldShowExtras = useMemo(
    () => visiblePlanTypes.includes('default') && visiblePlanTypes.length === 1,
    [visiblePlanTypes]
  );

  // An array of all the prices that should be displayed in the UI
  const filteredPriceProducts = useMemo((): SinglePricedProduct[] => {
    if (productsContext.products.length) {
      const filterAmount = productsContext.products.map(
        (product: Product): SinglePricedProduct => {
          const filteredPrices = product.prices.filter((price: Price) => {
            const interval = price.recurring?.interval;
            return (
              // only show monthly/annual plans based on toggle value
              interval === state.intervalFilter &&
              // don't show recurring add-ons
              product.metadata.product_type === 'plan' &&
              // only show products that don't have a `plan_type` or those that match the `?type=` query param
              (visiblePlanTypes.includes(product.metadata?.plan_type || '') ||
                (!product.metadata?.plan_type &&
                  visiblePlanTypes.includes('default')))
            );
          });

          return {
            ...product,
            price: filteredPrices[0],
          };
        }
      );

      return filterAmount.filter((price) => price.price);
    }
    return [];
  }, [productsContext.products, state.intervalFilter, visiblePlanTypes]);

  const getSubscribedProduct = useCallback(getSubscriptionsForProductId, []);

  const isSubscribedProduct = useCallback(
    (product: SinglePricedProduct, quantity = null) => {
      if (!product.price?.unit_amount && !hasActiveSubscription) {
        return true;
      }

      const subscriptions = getSubscribedProduct(
        product.id,
        state.subscribedProduct
      );

      if (subscriptions && subscriptions.length > 0) {
        return subscriptions.some(
          (subscription: SubscriptionInfo) =>
            subscription.items[0].price.id === product.price.id &&
            hasManageableStatus(subscription) &&
            quantity &&
            quantity === subscription.quantity
        );
      }
      return false;
    },
    [state.subscribedProduct, state.intervalFilter, productsContext.products]
  );

  const dismissConfirmModal = () => {
    setConfirmModal((prevState) => {
      return {...prevState, newPrice: null, currentSubscription: null};
    });
  };

  const buySubscription = (price: Price, quantity: number = 1) => {
    if (!price.id || isDisabled || !state.organization?.id) {
      return;
    }
    setIsBusy(true);
    if (activeSubscriptions.length) {
      if (!isDowngrade(activeSubscriptions, price, quantity)) {
        // if the user is upgrading prices, send them to the customer portal
        // this will immediately change their subscription
        postCustomerPortal(state.organization.id, price.id, quantity)
          .then(processCheckoutResponse)
          .catch(() => setIsBusy(false));
      } else {
        // if the user is downgrading prices, open a confirmation dialog and downgrade from kpi
        // this will downgrade the subscription at the end of the current billing period
        setConfirmModal({
          products: productsContext.products,
          newPrice: price,
          currentSubscription: activeSubscriptions[0],
          quantity: quantity,
        });
      }
    } else {
      // just send the user to the checkout page
      postCheckout(price.id, state.organization.id, quantity)
        .then(processCheckoutResponse)
        .catch(() => setIsBusy(false));
    }
  };

  const hasMetaFeatures = () => {
    let expandBool = false;
    if (productsContext.products.length) {
      filteredPriceProducts.map((product) => {
        for (const featureItem in product.metadata) {
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
  }, [productsContext.products]);

  if (!productsContext.products.length || !state.organization) {
    return null;
  }

  const comparisonButton = () =>
    hasMetaFeatures() && (
      <div className={styles.comparisonButton}>
        <Button
          type='full'
          color='light-storm'
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
    );

  return (
    <>
      {isDataLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {isUnauthorized && (
            <InlineMessage
              classNames={[styles.sticky]}
              message={t(
                'Please contact your organization owner for any changes to your plan or add-ons.'
              )}
              type={'warning'}
            />
          )}
          <div
            ref={pageBody}
            className={classnames(styles.accountPlan, {
              [styles.wait]: isBusy,
              [styles.unauthorized]: isUnauthorized,
              [styles.showAddOns]: props.showAddOns,
            })}
          >
            {!props.showAddOns && (
              <>
                <div className={styles.plansSection}>
                  <form className={styles.intervalToggle}>
                    <input
                      type='radio'
                      id='switch_left'
                      name='switchToggle'
                      value='month'
                      aria-label={t('show monthly plans')}
                      onChange={() => !isDisabled && dispatch({type: 'month'})}
                      aria-disabled={isDisabled}
                      checked={state.filterToggle}
                    />
                    <label htmlFor='switch_left'> {t('Monthly')}</label>

                    <input
                      type='radio'
                      id='switch_right'
                      name='switchToggle'
                      value='year'
                      onChange={() => !isDisabled && dispatch({type: 'year'})}
                      aria-disabled={isDisabled}
                      checked={!state.filterToggle}
                      aria-label={t('show annual plans')}
                    />
                    <label htmlFor='switch_right'>{t('Annual')}</label>
                  </form>

                  <div className={styles.allPlans}>
                    {filteredPriceProducts.map(
                      (product: SinglePricedProduct) => (
                        <div className={styles.stripePlans} key={product.id}>
                          <PlanContainer
                            key={product.price.id}
                            freeTierOverride={freeTierOverride}
                            expandComparison={expandComparison}
                            isSubscribedProduct={isSubscribedProduct}
                            product={product}
                            filteredPriceProducts={filteredPriceProducts}
                            hasManageableStatus={hasManageableStatus}
                            setIsBusy={setIsBusy}
                            isDisabled={isDisabled}
                            state={state}
                            buySubscription={buySubscription}
                            activeSubscriptions={activeSubscriptions}
                          />
                        </div>
                      )
                    )}
                    {shouldShowExtras && (
                      <div className={styles.enterprisePlanContainer}>
                        <div
                          className={
                            expandComparison
                              ? `${styles.enterprisePlan} ${styles.expandedEnterprisePlan}`
                              : styles.enterprisePlan
                          }
                        >
                          <h1 className={styles.enterpriseTitle}>
                            {' '}
                            {t('Want more?')}
                          </h1>
                          <div className={styles.priceTitle}>
                            {t('Contact us')}
                          </div>
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
                    )}
                  </div>
                  <div className={styles.minimizedCards}>
                    {comparisonButton()}
                  </div>

                  <div className={styles.maximizedCards}>
                    {comparisonButton()}
                  </div>
                </div>
              </>
            )}
            {props.showAddOns && (
              <AddOnList
                isBusy={isBusy}
                setIsBusy={setIsBusy}
                products={productsContext.products}
                organization={state.organization}
                onClickBuy={buySubscription}
              />
            )}
            {showGoTop && (
              <button
                onClick={handleScrollUp}
                className={styles.scrollToTopButton}
              >
                <i className='k-icon k-icon-arrow-up k-icon--size-m' />
              </button>
            )}
            <ConfirmChangeModal
              onRequestClose={dismissConfirmModal}
              setIsBusy={setIsBusy}
              {...confirmModal}
            />
          </div>
        </>
      )}
    </>
  );
}
