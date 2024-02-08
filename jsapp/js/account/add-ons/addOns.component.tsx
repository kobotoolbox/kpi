import React from 'react';
import styles from './addOns.module.scss';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import { ProductsContext, useProducts } from '../useProducts.hook';
import {YourPlan} from 'js/account/usage/yourPlan.component';
import Plan from '../plans/plan.component';

export default function addOns() {
  const usage = useUsage();
  const products = useProducts();

  return (
    <div className={styles.root}>
      <UsageContext.Provider value={usage}>
        <ProductsContext.Provider value={products}>
          <LimitNotifications usagePage />
          <header className={styles.header}>
            <h2 className={styles.headerText}>{t('Your plan')}</h2>
          </header>
          <YourPlan />
          <Plan showAddOns={true} />
        </ProductsContext.Provider>
      </UsageContext.Provider>
    </div>
  );
}
