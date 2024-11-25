import React from 'react';
import styles from './addOns.module.scss';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import {YourPlan} from 'js/account/usage/yourPlan.component';
import Plan from '../plans/plan.component';

export default function addOns() {
  return (
    <div className={styles.root}>
      <LimitNotifications accountPage />
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Your plan')}</h2>
      </header>
      <YourPlan />
      <Plan showAddOns={true} />
    </div>
  );
}
