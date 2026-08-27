import React from 'react'

import cx from 'classnames'

import { NavLink } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import securityStyles from '#/account/security/securityRoute.module.scss'
import Button from '#/components/common/button'
import envStore from '#/envStore'
import { PATHS } from '#/router/routerConstants'
import { useSession } from '#/stores/useSession'
import { getConnectedApp } from '../sso/sso.utils'
import styles from './passwordSection.module.scss'

const HIDDEN_TOKEN_VALUE = '● '.repeat(10)

export default function PasswordSection() {
  const { currentLoggedAccount } = useSession()
  const connectedApp = getConnectedApp(envStore.data, currentLoggedAccount)

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Password')}</h2>
      </div>

      {connectedApp?.managed ? (
        <div className={cx(securityStyles.securitySectionBody, styles.notPermitted)}>
          {t('Basic authentication not permitted')}
        </div>
      ) : (
        <>
          <div className={securityStyles.securitySectionBody}>
            <p className={styles.passwordDisplay}>{HIDDEN_TOKEN_VALUE}</p>
          </div>

          <div className={styles.options}>
            <a href={PATHS.RESET}>
              <Button label={t('Forgot password')} size='m' type='text' />
            </a>

            <NavLink to={`${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}>
              <Button
                label={t('Update')}
                size='m'
                type='primary'
                onClick={() => {
                  /*TODO: Handle NavLink and Button*/
                }}
              />
            </NavLink>
          </div>
        </>
      )}
    </section>
  )
}
