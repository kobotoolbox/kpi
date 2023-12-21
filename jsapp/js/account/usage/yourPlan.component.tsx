import usageStyles from 'js/account/usage/usage.module.scss';
import styles from 'js/account/usage/yourPlan.module.scss';
import React, {useContext, useMemo, useState} from 'react';
import {formatDate} from 'js/utils';
import Badge from 'js/components/common/badge';
import subscriptionStore from 'js/account/subscriptionStore';
import sessionStore from 'js/stores/session';
import BillingButton from 'js/account/plans/billingButton.component';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import envStore from 'js/envStore';
import {PlanNames} from 'js/account/stripe.types';
import {UsageContext} from 'js/account/usage/useUsage.hook';

/*
 * Show the user's current plan and any storage add-ons, with links to the Plans page
 */
export const YourPlan = () => {
  const [subscriptions] = useState(() => subscriptionStore);
  const [env] = useState(() => envStore);
  const [session] = useState(() => sessionStore);
  const usage = useContext(UsageContext);

  /*
   * The plan name displayed to the user. This will display, in order of precedence:
   * * The user's active plan subscription
   * * The FREE_TIER_DISPLAY["name"] setting (if the user registered before FREE_TIER_CUTOFF_DATE
   * * The free plan
   */
  const planName = useMemo(() => {
    if (subscriptions.planResponse.length) {
      return subscriptions.planResponse[0].items[0].price.product.name;
    }
    return env.data?.free_tier_display?.name || PlanNames.FREE;
  }, [env.isReady, subscriptions.isInitialised]);

  // The start date of the user's plan. Defaults to the account creation date if the user doesn't have a subscription.
  const startDate = useMemo(() => {
    let date;
    if (subscriptions.planResponse.length) {
      date = subscriptions.planResponse[0].start_date;
    } else {
      date = session.currentAccount.date_joined;
    }
    return formatDate(date);
  }, [env.isReady, subscriptions.isInitialised]);

  return (
    <article>
      <header className={usageStyles.header}>
        <h2 className={usageStyles.headerText}>{t('Your plan')}</h2>
      </header>
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
          {usage.billingPeriodEnd && subscriptions.planResponse.length > 0 && (
            <Badge
              color={'light-blue'}
              size={'s'}
              label={
                <time
                  dateTime={usage.billingPeriodEnd}
                  className={styles.renewal}
                >
                  {t('Renews on ##renewal_date##').replace(
                    '##renewal_date##',
                    formatDate(usage.billingPeriodEnd)
                  )}
                </time>
              }
            />
          )}
        </div>
        <nav>
          <BillingButton
            label={'see plans'}
            type={'frame'}
            color={'blue'}
            onClick={() => window.location.assign('#' + ACCOUNT_ROUTES.PLAN)}
          />
          {/* This is commented out until the add-ons tab on the Plans page is implemented
        <BillingButton
          label={'get add-ons'}
          type={'full'}
          color={'blue'}
          // TODO: change this to point to the add-ons tab
          onClick={() => window.location.assign('#' + ACCOUNT_ROUTES.PLAN)}
        />
         */}
        </nav>
      </section>
    </article>
  );
};
