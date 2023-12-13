import usageStyles from 'js/account/usage/usage.module.scss';
import styles from 'js/account/usage/yourPlan.module.scss';
import React, {useState} from 'react';
import {formatDate} from 'js/utils';
import Badge from 'js/components/common/badge';
import subscriptionStore from 'js/account/subscriptionStore';
import sessionStore from 'js/stores/session';
import AriaText from 'js/components/common/ariaText';

interface YourPlanState {
  renewalDate: string | null;
}

export const YourPlan = ({renewalDate}: YourPlanState) => {
  const [subscriptions] = useState(() => subscriptionStore);
  const [session] = useState(() => sessionStore);

  return (
    <section>
      <header className={usageStyles.header}>
        <h2 className={usageStyles.headerText}>{t('Your plan')}</h2>
      </header>
      <p className={styles.plan}>
        {/* TODO: handle legacy/custom plan names */}
        {subscriptions.planResponse.length
          ? subscriptions.planResponse[0].items?.[0].price.product.name
          : t('Community Plan')}
        {subscriptions.addOnsResponse.length > 0 && (
          <span className={styles.addOn}>
            <AriaText uiText={'+'} screenReaderText={'plus'} />{' '}
            {subscriptions.addOnsResponse[0].items?.[0].price.product.name}
          </span>
        )}
      </p>
      <time>
        {t('Started on ##start_date##').replace(
          '##start_date##',
          formatDate(
            subscriptions.planResponse.length
              ? subscriptions.planResponse[0].start_date
              : session.currentAccount.date_joined
          )
        )}
      </time>
      {renewalDate && (
        <Badge
          color={'light-blue'}
          size={'s'}
          label={
            <div className={styles.renewal}>
              {t('Renews on ##renewal_date##')
                .replace('##renewal_date##', formatDate(renewalDate))
                .toLocaleUpperCase()}
            </div>
          }
        />
      )}
    </section>
  );
};
