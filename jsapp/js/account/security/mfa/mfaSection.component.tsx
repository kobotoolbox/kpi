// Libraries
import React from 'react';
import cx from 'classnames';

// Partial components
import Button from 'js/components/common/button';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Icon from 'js/components/common/icon';
import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';

// Reflux
import type {
  MfaUserMethodsResponse,
  MfaActivatedResponse,
} from 'js/actions/mfaActions';
import mfaActions from 'js/actions/mfaActions';

// Constants and utils
import {MODAL_TYPES} from 'jsapp/js/constants';
import {formatTime, formatDate} from 'js/utils';

// Stores
import envStore from 'js/envStore';
import pageState from 'js/pageState.store';

// Styles
import styles from './mfaSection.module.scss';
import securityStyles from 'js/account/security/securityRoute.module.scss';

interface SecurityState {
  isMfaAvailable?: boolean;
  isMfaActive: boolean;
  isPlansMessageVisible?: boolean;
  dateDisabled?: string;
  dateModified?: string;
}

type EditModalTypes = 'reconfigure' | 'regenerate';

export default class SecurityRoute extends React.Component<{}, SecurityState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isMfaAvailable: undefined,
      isMfaActive: false,
      isPlansMessageVisible: undefined,
      dateDisabled: undefined,
      dateModified: undefined,
    };
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      mfaActions.getUserMethods.completed.listen(
        this.onGetUserMethodsCompleted.bind(this)
      ),
      mfaActions.getMfaAvailability.completed.listen(
        this.onGetMfaAvailability.bind(this)
      ),
      mfaActions.activate.completed.listen(this.mfaActivating.bind(this)),
      mfaActions.confirmCode.completed.listen(this.mfaActivated.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this))
    );

    mfaActions.getUserMethods();
    mfaActions.getMfaAvailability();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onGetUserMethodsCompleted(response: MfaUserMethodsResponse) {
    if (response.length) {
      this.setState({
        isMfaActive: response[0].is_active,
        dateDisabled: response[0].date_disabled,
        dateModified: response[0].date_modified,
      });
    }
  }

  onGetMfaAvailability(response: {isMfaAvailable: boolean; isPlansMessageVisible: boolean}) {
    // Determine whether MFA is allowed based on per-user availability and subscription status
    this.setState({
      isMfaAvailable: response.isMfaAvailable,
      isPlansMessageVisible: response.isPlansMessageVisible,
    });
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
      });
    }
  }

  mfaActivated() {
    this.setState({
      isMfaActive: true,
      dateDisabled: undefined,
    });
  }

  mfaDeactivated() {
    this.setState({isMfaActive: false});
    mfaActions.getUserMethods();
  }

  onToggleChange(isActive: boolean) {
    if (!this.state.isMfaAvailable) {
      return;
    }
    if (isActive) {
      mfaActions.activate();
    } else {
      pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        modalType: 'deactivate',
        customModalHeader: this.renderCustomHeader(),
        disableBackdropClose: true,
        disableEscClose: true,
      });
    }
  }

  showEditModal(
    evt: React.ChangeEvent<HTMLInputElement>,
    type: EditModalTypes
  ) {
    evt.preventDefault();

    pageState.showModal({
      type: MODAL_TYPES.MFA_MODALS,
      modalType: type,
      customModalHeader: this.renderCustomHeader(),
      disableBackdropClose: true,
      disableEscClose: true,
    });
  }

  renderCustomHeader() {
    return (
      <header className='table-media-preview-header'>
        <div className='table-media-preview-header__title'>
          <Icon name='lock' size='s' />
          {t('Two-factor authentication')}
        </div>
      </header>
    );
  }

  render() {
    if (!envStore.isReady || this.state.isMfaAvailable === undefined) {
      return <LoadingSpinner />;
    }

    if (!envStore.data.mfa_enabled || (!this.state.isMfaAvailable && !this.state.isPlansMessageVisible)) {
      return null;
    }

    return (
      <section className={cx(securityStyles.securitySection, {
        [styles.isUnauthorized]: !this.state.isMfaAvailable,
      })}>
        <div className={securityStyles.securitySectionTitle}>
          <h2 className={securityStyles.securitySectionTitleText}>
            {t('Two-factor authentication')}
          </h2>
        </div>

        <div className={cx(securityStyles.securitySectionBody, styles.body)}>
          <div className={styles.bodyMain}>
            <p className={styles.mfaDescription}>
              {t(
                'Two-factor authentication (2FA) verifies your identity using an authenticator application in addition to your usual password. ' +
                  'We recommend enabling two-factor authentication for an additional layer of protection.'
              )}
            </p>

            {this.state.isMfaActive && this.state.isMfaAvailable && (
              <div className={styles.mfaOptions}>
                <div className={styles.mfaOptionsRow}>
                  <h3 className={styles.mfaOptionsLabel}>
                    {t('Authenticator app')}
                  </h3>

                  {this.state.dateModified && (
                    <div>
                      {formatTime(this.state.dateModified)}
                    </div>
                  )}

                  <Button
                    type='primary'
                    label={t('Reconfigure')}
                    size='m'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'reconfigure');
                    }}
                  />
                </div>

                <div className={styles.mfaOptionsRow}>
                  <h3 className={styles.mfaOptionsLabel}>
                    {t('Recovery codes')}
                  </h3>

                  <Button
                    type='primary'
                    label={t('Generate new')}
                    size='m'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'regenerate');
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {!this.state.isMfaActive && this.state.isMfaAvailable && this.state.dateDisabled && (
            <InlineMessage
              type='default'
              message={t(
                'Two-factor authentication was deactivated for your account on ##date##'
              ).replace('##date##', formatDate(this.state.dateDisabled))}
            />
          )}

          {this.state.isPlansMessageVisible && (
            <InlineMessage
              type='default'
              message={
              <>
                {t('This feature is not available on your current plan. Please visit the ')}
                <a href={'/#/account/plan'}>{t('Plans page')}</a>
                {t(' to upgrade your account.')}
              </>
            }
            />
          )}
        </div>

        <div className={styles.options}>
          <ToggleSwitch
            label={(this.state.isMfaActive && this.state.isMfaAvailable) ? t('Enabled') : t('Disabled')}
            checked={this.state.isMfaActive && this.state.isMfaAvailable}
            onChange={this.onToggleChange.bind(this)}
          />
        </div>
      </section>
    );
  }
}
