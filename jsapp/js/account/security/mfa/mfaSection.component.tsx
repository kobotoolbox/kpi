import { Switch } from '@mantine/core'
import cx from 'classnames'
import securityStyles from '#/account/security/securityRoute.module.scss'
import type { MfaModalType } from '#/components/bigModal/mfaModals'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import Tooltip from '#/components/common/tooltip'
import { MODAL_TYPES } from '#/constants'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import profileStore from '#/stores/profile'
import { formatTime } from '#/utils'
import { useMfaActivate, useMfaStatus } from './mfa.api'
import styles from './mfaSection.module.scss'

/** Shown above every step, since they share one title */
function renderModalHeader() {
  return (
    <header className='table-media-preview-header'>
      <div className='table-media-preview-header__title'>
        <Icon name='lock' size='s' />
        {t('Two-factor authentication')}
      </div>
    </header>
  )
}

/** Steps run in `BigModal`, so opening one writes to `pageState` */
function showMfaModal(modalType: MfaModalType, qrCode?: string) {
  pageState.showModal({
    type: MODAL_TYPES.MFA_MODALS,
    modalType,
    qrCode,
    customModalHeader: renderModalHeader(),
    disableBackdropClose: true,
    disableEscClose: true,
  })
}

export default function MfaSection() {
  const { data: mfaStatus } = useMfaStatus()
  const activate = useMfaActivate()

  const isMfaActive = mfaStatus?.isActive ?? false

  const isSuperuserMfaLocked =
    envStore.data.superuser_auth_enforcement &&
    'is_superuser' in profileStore.currentAccount &&
    profileStore.currentAccount.is_superuser

  const isDisabled = isSuperuserMfaLocked && isMfaActive

  function onToggleChange(isActive: boolean) {
    if (isActive) {
      // The switch stays off until a token is confirmed, which is the modal's job
      activate.mutate(undefined, { onSuccess: ({ qrCodeUrl }) => showMfaModal('qr', qrCodeUrl) })
    } else {
      showMfaModal('deactivate')
    }
  }

  const toggle = (
    <div className={styles.options}>
      <Switch
        label={isMfaActive ? t('Enabled') : t('Disabled')}
        checked={isMfaActive}
        onChange={(event) => onToggleChange(event.currentTarget.checked)}
        disabled={isDisabled}
      />
    </div>
  )

  if (!envStore.data.mfa_enabled) {
    return null
  }

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Two-factor authentication')}</h2>
      </div>

      <div className={cx(securityStyles.securitySectionBody, styles.body)}>
        <div>
          <p className={styles.mfaDescription}>
            {t(
              'Two-factor authentication (2FA) verifies your identity using an authenticator application in addition to your usual password. ' +
                'We recommend enabling two-factor authentication for an additional layer of protection.',
            )}
          </p>

          {isMfaActive && (
            <div className={styles.mfaOptions}>
              <div className={styles.mfaOptionsRow}>
                <h3 className={styles.mfaOptionsLabel}>{t('Authenticator app')}</h3>

                {mfaStatus?.dateModified && <div>{formatTime(mfaStatus.dateModified)}</div>}

                <Button type='primary' label={t('Reconfigure')} size='m' onClick={() => showMfaModal('reconfigure')} />
              </div>

              <div className={styles.mfaOptionsRow}>
                <h3 className={styles.mfaOptionsLabel}>{t('Recovery codes')}</h3>

                <Button type='primary' label={t('Generate new')} size='m' onClick={() => showMfaModal('regenerate')} />
              </div>
            </div>
          )}
        </div>
      </div>

      {isDisabled ? (
        <Tooltip
          text={t('Superusers cannot deactivate their MFA')}
          ariaLabel={t('MFA restriction explanation')}
          alignment='right'
        >
          {toggle}
        </Tooltip>
      ) : (
        toggle
      )}
    </section>
  )
}
