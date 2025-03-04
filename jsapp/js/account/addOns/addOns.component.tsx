import React from 'react'

import { YourPlan } from '#/account/usage/yourPlan.component'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import Plan from '../plans/plan.component'
import styles from './addOns.module.scss'

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
  )
}
