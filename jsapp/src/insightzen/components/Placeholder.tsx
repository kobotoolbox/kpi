import React from 'react'

import { useInsightZenI18n } from '../i18n/context'
import layoutStyles from '../styles/Layout.module.scss'

export default function InsightZenPlaceholder({ title }: { title: string }) {
  const { t } = useInsightZenI18n()
  return (
    <div className={layoutStyles.notice}>
      {t('comingSoon')} {title}
    </div>
  )
}
