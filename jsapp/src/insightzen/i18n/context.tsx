import React, { createContext, useContext, useMemo, useState } from 'react'

import { type InsightZenLocale, insightZenTranslations } from './translations'

type I18nContextValue = {
  locale: InsightZenLocale
  dir: 'ltr' | 'rtl'
  t: (key: string) => string
  switchLocale: (locale: InsightZenLocale) => void
}

const InsightZenI18nContext = createContext<I18nContextValue | undefined>(undefined)

export function InsightZenI18nProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [locale, setLocale] = useState<InsightZenLocale>('fa')
  const value = useMemo<I18nContextValue>(() => {
    const translations = insightZenTranslations[locale]
    return {
      locale,
      dir: locale === 'fa' ? 'rtl' : 'ltr',
      t: (key: string) => translations[key] ?? key,
      switchLocale: setLocale,
    }
  }, [locale])

  return <InsightZenI18nContext.Provider value={value}>{children}</InsightZenI18nContext.Provider>
}

export function useInsightZenI18n() {
  const context = useContext(InsightZenI18nContext)
  if (!context) {
    throw new Error('useInsightZenI18n must be used within InsightZenI18nProvider')
  }
  return context
}
