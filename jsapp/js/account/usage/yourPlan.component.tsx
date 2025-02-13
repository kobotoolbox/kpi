import styles from 'js/account/usage/yourPlan.module.scss';
import React, {useContext, useMemo, useState} from 'react';
import {formatDate} from 'js/utils';
import Badge, {BadgeColor} from 'js/components/common/badge';
import subscriptionStore from 'js/account/subscriptionStore';
import sessionStore from 'js/stores/session';
import BillingButton from 'js/account/plans/billingButton.component';
import envStore from 'js/envStore';
import {
  PlanNames,
  Product,
  SubscriptionChangeType,
} from 'js/account/stripe.types';
import {ProductsContext} from '../useProducts.hook';
import {getSubscriptionChangeDetails} from '../stripe.utils';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {useOrganizationQuery} from '../organization/organizationQuery';

const BADGE_COLOR_KEYS: {[key in SubscriptionChangeType]: BadgeColor} = {
  [SubscriptionChangeType.RENEWAL]: 'light-blue',
  [SubscriptionChangeType.CANCELLATION]: 'light-red',
  [SubscriptionChangeType.PRODUCT_CHANGE]: 'light-amber',
  [SubscriptionChangeType.PRICE_CHANGE]: 'light-amber',
  [SubscriptionChangeType.QUANTITY_CHANGE]: 'light-amber',
  [SubscriptionChangeType.NO_CHANGE]: 'light-blue',
};

/*
 * Show the user's current plan and any storage add-ons, with links to the Plans page
 */
export const YourPlan = () => {
  const [subscriptions] = useState(() => subscriptionStore);
  const [env] = useState(() => envStore);
  const [session] = useState(() => sessionStore);
  const [productsContext] = useContext(ProductsContext);
  const orgQuery = useOrganizationQuery();

  const planName = subscriptions.planName;

  // The start date of the user's plan. Defaults to the account creation date if the user doesn't have a subscription.
  const startDate = useMemo(() => {
    let date;
    if (subscriptions.planResponse.length) {
      date = subscriptions.planResponse[0].start_date;
    } else if (subscriptions.canceledPlans.length){
      date =
        subscriptions.canceledPlans[subscriptions.canceledPlans.length - 1]
          .ended_at;
    } else {
      date = session.currentAccount.date_joined;
    }
    return formatDate(date);
  }, [env.isReady, subscriptions.isInitialised]);

  const currentPlan = useMemo(() => {
    if (subscriptionStore.planResponse.length) {
      return subscriptions.planResponse[0];
    } else {
      return null;
    }
  }, [env.isReady, subscriptions.isInitialised]);

  const showPlanUpdateLink = orgQuery.data?.request_user_role === 'owner';

  const subscriptionUpdate = useMemo(() => {
    return getSubscriptionChangeDetails(currentPlan, productsContext.products);
  }, [currentPlan, productsContext.isLoaded]);

  return (
    <article>
      <section className={styles.section}>
        <div className={styles.planInfo}>
          <p className={styles.plan}>
            <strong>
              {t('##plan_name## Plan').replace('##plan_name##', planName)}
            </strong>
          </p>
          <time dateTime={startDate} className={styles.start}>
            {t('Started on ##start_date##').replace(
              '##start_date##',
              startDate
            )}
          </time>
          {subscriptionUpdate && (
            <Badge
              color={BADGE_COLOR_KEYS[subscriptionUpdate.type]!}
              size={'s'}
              label={
                <time
                  dateTime={subscriptionUpdate.date}
                  className={styles.updateBadge}
                >
                  {subscriptionUpdate.type === SubscriptionChangeType.RENEWAL &&
                    t('Renews on ##renewal_date##').replace(
                      '##renewal_date##',
                      formatDate(subscriptionUpdate.date)
                    )}
                  {[
                    SubscriptionChangeType.CANCELLATION,
                    SubscriptionChangeType.PRODUCT_CHANGE,
                  ].includes(subscriptionUpdate.type) &&
                    t('Ends on ##end_date##').replace(
                      '##end_date##',
                      formatDate(subscriptionUpdate.date)
                    )}
                  {subscriptionUpdate.type ===
                    SubscriptionChangeType.QUANTITY_CHANGE &&
                    t('Changing usage limits on ##change_date##').replace(
                      '##change_date##',
                      formatDate(subscriptionUpdate.date)
                    )}
                  {subscriptionUpdate.type ===
                    SubscriptionChangeType.PRICE_CHANGE &&
                    t('Switching to monthly on ##change_date##').replace(
                      '##change_date##',
                      formatDate(subscriptionUpdate.date)
                    )}
                </time>
              }
            />
          )}
        </div>
        {showPlanUpdateLink && (
          <nav>
            <BillingButton
              label={'See plans'}
              type='secondary'
              onClick={() => window.location.assign('#' + ACCOUNT_ROUTES.PLAN)}
            />
            {/* This is commented out until the add-ons tab on the Plans page is implemented
              <BillingButton
                label={'get add-ons'}
                // TODO: change this to point to the add-ons tab
                onClick={() => window.location.assign('#' + ACCOUNT_ROUTES.PLAN)}
              />
            */}
          </nav>
        )}
      </section>
      {subscriptionUpdate?.type === SubscriptionChangeType.CANCELLATION && (
        <div className={styles.subscriptionChangeNotice}>
          {t(
            'Your ##current_plan## plan has been canceled but will remain active until the end of the billing period.'
          ).replace('##current_plan##', planName)}
        </div>
      )}
      {subscriptionUpdate?.type === SubscriptionChangeType.PRODUCT_CHANGE && (
        <div className={styles.subscriptionChangeNotice}>
          {t(
            'Your ##current_plan## plan will change to the ##next_plan## plan on'
          )
            .replace('##current_plan##', planName)
            .replace('##next_plan##', subscriptionUpdate.nextProduct!.name)}
          &nbsp;
          <time dateTime={subscriptionUpdate.date}>
            {formatDate(subscriptionUpdate.date)}
          </time>
          {t(
            '. You can continue using ##current_plan## plan features until the end of the billing period.'
          ).replace('##current_plan##', planName)}
        </div>
      )}
      {subscriptionUpdate?.type === SubscriptionChangeType.QUANTITY_CHANGE && (
        <div className={styles.subscriptionChangeNotice}>
          {t(
            'Your ##current_plan## plan will change to include up to ##submission_quantity## submissions/month starting from'
          )
            .replace('##current_plan##', planName)
            .replace(
              '##submission_quantity##',
              (
                subscriptions.planResponse[0].schedule.phases?.[1].items[0]
                  .quantity || ''
              ).toLocaleString()
            )}
          &nbsp;
          <time dateTime={subscriptionUpdate.date}>
            {formatDate(subscriptionUpdate.date)}
          </time>
          .
        </div>
      )}
      {subscriptionUpdate?.type === SubscriptionChangeType.PRICE_CHANGE && (
        <div className={styles.subscriptionChangeNotice}>
          {t(
            'Your ##current_plan## plan will change from annual to monthly starting from'
          ).replace('##current_plan##', planName)}
          &nbsp;
          <time dateTime={subscriptionUpdate.date}>
            {formatDate(subscriptionUpdate.date)}
          </time>
          .
        </div>
      )}
    </article>
  );
};
