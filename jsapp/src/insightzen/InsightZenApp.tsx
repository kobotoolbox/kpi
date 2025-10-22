import React, { useMemo, useState } from 'react'

import { NavLink, Outlet, useLocation } from 'react-router-dom'
import sessionStore from '#/stores/session'

import { INSIGHTZEN_MODULE_GROUPS } from './constants'
import { InsightZenI18nProvider, useInsightZenI18n } from './i18n/context'
import layoutStyles from './styles/Layout.module.scss'

function LocaleSwitcher() {
  const { locale, switchLocale, t } = useInsightZenI18n()
  return (
    <div className={layoutStyles.localeSwitch} role='group' aria-label='language selector'>
      <button
        type='button'
        className={`${layoutStyles.localeButton} ${locale === 'fa' ? layoutStyles.localeButtonActive : ''}`}
        onClick={() => switchLocale('fa')}
      >
        {t('faLabel')}
      </button>
      <button
        type='button'
        className={`${layoutStyles.localeButton} ${locale === 'en' ? layoutStyles.localeButtonActive : ''}`}
        onClick={() => switchLocale('en')}
      >
        {t('enLabel')}
      </button>
    </div>
  )
}

function InsightZenShell() {
  const { t, dir } = useInsightZenI18n()
  const [openGroup, setOpenGroup] = useState<string>('management')
  const location = useLocation()

  const extraDetails =
    'extra_details' in sessionStore.currentAccount ? sessionStore.currentAccount.extra_details : undefined
  const isPersonal = extraDetails?.account_type === 'personal'
  const paymentPending = extraDetails?.payment_status === 'pending'

  const isDarkAccessible = useMemo(
    () => ({
      dir,
      style: { direction: dir as 'rtl' | 'ltr' },
    }),
    [dir],
  )

  return (
    <div className={layoutStyles.shell} style={isDarkAccessible.style} dir={dir}>
      <aside className={layoutStyles.sidebar}>
        {INSIGHTZEN_MODULE_GROUPS.map((group) => {
          const isOpen = openGroup === group.id
          return (
            <div className={layoutStyles.menuGroup} key={group.id}>
              <button
                type='button'
                className={layoutStyles.menuHeader}
                onClick={() => setOpenGroup(group.id)}
                aria-expanded={isOpen}
              >
                <span>{t(group.labelKey)}</span>
                <span>{isOpen ? '▾' : '▸'}</span>
              </button>
              <div className={`${layoutStyles.menuItems} ${isOpen ? '' : layoutStyles.menuItemsClosed}`} role='menu'>
                {group.panels.map((panel) => {
                  const disabled = isPersonal || paymentPending
                  return (
                    <NavLink
                      key={panel.route}
                      to={`/insightzen/${panel.route}`}
                      className={({ isActive }) =>
                        `${layoutStyles.menuLink} ${
                          isActive || location.pathname.endsWith(panel.route) ? layoutStyles.menuLinkActive : ''
                        } ${disabled ? layoutStyles.menuLinkDisabled : ''}`
                      }
                      onClick={(event) => {
                        if (disabled) {
                          event.preventDefault()
                          if (paymentPending) {
                            window.location.href = '/accounts/organizational-payment/'
                          }
                        }
                      }}
                    >
                      {t(panel.labelKey)}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </aside>
      <div>
        <header className={layoutStyles.header}>
          <div className={layoutStyles.appName}>InsightZen</div>
          <LocaleSwitcher />
        </header>
        <main className={layoutStyles.mainContent}>
          {isPersonal ? (
            <div className={layoutStyles.notice}>{t('personalAccountNotice')}</div>
          ) : paymentPending ? (
            <div className={layoutStyles.notice}>
              <p>{t('pendingPaymentNotice')}</p>
              <button
                type='button'
                className={layoutStyles.primaryButton}
                onClick={() => {
                  window.location.href = '/accounts/organizational-payment/'
                }}
              >
                {t('goToPayment')}
              </button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function InsightZenApp() {
  return (
    <InsightZenI18nProvider>
      <InsightZenShell />
    </InsightZenI18nProvider>
  )
}
