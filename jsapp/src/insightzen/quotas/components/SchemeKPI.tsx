import React from 'react'

import type { QuotaStats } from '../../api/quotas'
import styles from '../../styles/Quota.module.scss'
import { useInsightZenI18n } from '../../i18n/context'

interface SchemeKPIProps {
  stats: QuotaStats | null
}

export function SchemeKPI({ stats }: SchemeKPIProps) {
  const { t } = useInsightZenI18n()
  if (!stats) {
    return null
  }
  const completion = stats.target > 0 ? Math.min(1, stats.achieved / stats.target) : 0

  return (
    <div className={styles.kpiRow} role='status'>
      <article className={styles.kpiCard}>
        <strong>{t('totalTarget')}</strong>
        <span>{stats.target.toLocaleString()}</span>
      </article>
      <article className={styles.kpiCard}>
        <strong>{t('totalAchieved')}</strong>
        <span>{stats.achieved.toLocaleString()}</span>
      </article>
      <article className={styles.kpiCard}>
        <strong>{t('inProgress')}</strong>
        <span>{stats.in_progress.toLocaleString()}</span>
      </article>
      <article className={styles.kpiCard}>
        <strong>{t('remaining')}</strong>
        <span>{stats.remaining.toLocaleString()}</span>
      </article>
      <article className={styles.kpiCard}>
        <strong>{t('completion')}</strong>
        <span>{new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(completion)}</span>
      </article>
    </div>
  )
}
