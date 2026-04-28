import React from 'react'

import cx from 'classnames'
import securityStyles from '#/account/security/securityRoute.module.scss'
import type { MfaActivatedResponse, MfaUserMethodsResponse } from '#/actions/mfaActions'
import mfaActions from '#/actions/mfaActions'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import LoadingSpinner from '#/components/common/loadingSpinner'
import ToggleSwitch from '#/components/common/toggleSwitch'
import Tooltip from '#/components/common/tooltip'
import { MODAL_TYPES } from '#/constants'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import sessionStore from '#/stores/session'
import { formatTime } from '#/utils'
import styles from './mfaSection.module.scss'

interface SecurityState {
  isMfaActive: boolean
  dateDisabled?: string
  dateModified?: string
}

type EditModalTypes = 'reconfigure' | 'regenerate'

export default class SecurityRoute extends React.Component<{}, SecurityState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      isMfaActive: false,
      dateDisabled: undefined,
      dateModified: undefined,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      mfaActions.getUserMethods.completed.listen(this.onGetUserMethodsCompleted.bind(this)),
      mfaActions.activate.completed.listen(this.mfaActivating.bind(this)),
      mfaActions.confirmCode.completed.listen(this.mfaActivated.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this)),
    )

    mfaActions.getUserMethods()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onGetUserMethodsCompleted(response: MfaUserMethodsResponse) {
    if (response.length) {
      this.setState({
        isMfaActive: response[0].is_active,
        dateDisabled: response[0].date_disabled,
        dateModified: response[0].date_modified,
      })
    }
  }

  mfaActivating(response: MfaActivatedResponse) {
    if (response && !response.inModal) {
      pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        qrCode: response.details,
        modalType: 'qr',
        customModalHeader: this.renderCustomHeader(),
        disableBackdropClose: true,
        disableEscClose: true,
      })
    }
  }

  mfaActivated() {
    this.setState({
      isMfaActive: true,
      dateDisabled: undefined,
    })
  }

  mfaDeactivated() {
    this.setState({ isMfaActive: false })
    mfaActions.getUserMethods()
  }

  onToggleChange(isActive: boolean) {
    if (isActive) {
      mfaActions.activate()
    } else {
      pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        modalType: 'deactivate',
        customModalHeader: this.renderCustomHeader(),
        disableBackdropClose: true,
        disableEscClose: true,
      })
    }
  }

  showEditModal(evt: React.ChangeEvent<HTMLInputElement>, type: EditModalTypes) {
    evt.preventDefault()

    pageState.showModal({
      type: MODAL_TYPES.MFA_MODALS,
      modalType: type,
      customModalHeader: this.renderCustomHeader(),
      disableBackdropClose: true,
      disableEscClose: true,
    })
  }

  renderCustomHeader() {
    return (
      <header className='table-media-preview-header'>
        <div className='table-media-preview-header__title'>
          <Icon name='lock' size='s' />
          {t('Two-factor authentication')}
        </div>
      </header>
    )
  }

  render() {
    const isSuperuserMfaLocked =
      envStore.data.superuser_auth_enforcement &&
      'is_superuser' in sessionStore.currentAccount &&
      sessionStore.currentAccount.is_superuser

    const isDisabled = isSuperuserMfaLocked && this.state.isMfaActive

    const toggle = (
      <div className={styles.options}>
        <ToggleSwitch
          label={this.state.isMfaActive ? t('Enabled') : t('Disabled')}
          checked={this.state.isMfaActive}
          onChange={this.onToggleChange.bind(this)}
          disabled={isDisabled}
        />
      </div>
    )

    if (!envStore.isReady) {
      return <LoadingSpinner />
    }

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

            {this.state.isMfaActive && (
              <div className={styles.mfaOptions}>
                <div className={styles.mfaOptionsRow}>
                  <h3 className={styles.mfaOptionsLabel}>{t('Authenticator app')}</h3>

                  {this.state.dateModified && <div>{formatTime(this.state.dateModified)}</div>}

                  <Button
                    type='primary'
                    label={t('Reconfigure')}
                    size='m'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'reconfigure')
                    }}
                  />
                </div>

                <div className={styles.mfaOptionsRow}>
                  <h3 className={styles.mfaOptionsLabel}>{t('Recovery codes')}</h3>

                  <Button
                    type='primary'
                    label={t('Generate new')}
                    size='m'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'regenerate')
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {isDisabled ? (
          <Tooltip
            text={t('Superusers cannot deactivate their MFA.')}
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
}
