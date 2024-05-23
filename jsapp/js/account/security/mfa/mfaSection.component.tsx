import React from 'react';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Icon from 'js/components/common/icon';
import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import type {
  MfaUserMethodsResponse,
  MfaActivatedResponse,
} from 'js/actions/mfaActions';
import mfaActions from 'js/actions/mfaActions';
import {MODAL_TYPES} from 'jsapp/js/constants';
import envStore from 'js/envStore';
import './mfaSection.scss';
import {formatTime, formatDate} from 'js/utils';
import pageState from 'js/pageState.store';

bem.SecurityRow = makeBem(null, 'security-row');
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header');
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title', 'h2');
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons');
bem.SecurityRow__description = makeBem(bem.SecurityRow, 'description', 'p');
bem.SecurityRow__switch = makeBem(bem.SecurityRow, 'switch');

bem.MFAOptions = makeBem(null, 'mfa-options');
bem.MFAOptions__row = makeBem(bem.MFAOptions, 'row');
bem.MFAOptions__label = makeBem(bem.MFAOptions, 'label');
bem.MFAOptions__buttons = makeBem(bem.MFAOptions, 'buttons');
bem.MFAOptions__date = makeBem(bem.MFAOptions, 'date');

bem.TableMediaPreviewHeader = makeBem(null, 'table-media-preview-header');
bem.TableMediaPreviewHeader__title = makeBem(
  bem.TableMediaPreviewHeader,
  'title',
  'div'
);

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

  onGetMfaAvailability(response: {isMfaAvailable: boolean, isPlansMessageVisible: boolean}) {
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
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          <Icon name='lock' size='s' />
          {t('Two-factor authentication')}
        </bem.TableMediaPreviewHeader__title>
      </bem.TableMediaPreviewHeader>
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
      <>
        <bem.SecurityRow m={{unauthorized: !this.state.isMfaAvailable}}>
          <bem.SecurityRow__header>
            <bem.SecurityRow__title>
              {t('Two-factor authentication')}
            </bem.SecurityRow__title>

            <bem.SecurityRow__description>
              {t(
                'Two-factor authentication (2FA) verifies your identity using an authenticator application in addition to your usual password. ' +
                  'We recommend enabling two-factor authentication for an additional layer of protection.'
              )}
            </bem.SecurityRow__description>

            <bem.SecurityRow__switch>
              <bem.SecurityRow__buttons>
                <ToggleSwitch
                  label={(this.state.isMfaActive && this.state.isMfaAvailable) ? t('Enabled') : t('Disabled')}
                  checked={this.state.isMfaActive && this.state.isMfaAvailable}
                  onChange={this.onToggleChange.bind(this)}
                />
              </bem.SecurityRow__buttons>
            </bem.SecurityRow__switch>
          </bem.SecurityRow__header>

          {this.state.isMfaActive && this.state.isMfaAvailable && (
            <bem.MFAOptions>
              <bem.MFAOptions__row>
                <bem.MFAOptions__label>
                  {t('Authenticator app')}
                </bem.MFAOptions__label>

                {this.state.dateModified && (
                  <bem.MFAOptions__date>
                    {formatTime(this.state.dateModified)}
                  </bem.MFAOptions__date>
                )}

                <bem.MFAOptions__buttons>
                  <Button
                    type='frame'
                    color='storm'
                    label={t('Reconfigure')}
                    size='m'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'reconfigure');
                    }}
                  />
                </bem.MFAOptions__buttons>
              </bem.MFAOptions__row>

              <bem.MFAOptions__row>
                <bem.MFAOptions__label>
                  {t('Recovery codes')}
                </bem.MFAOptions__label>

                <bem.MFAOptions__buttons>
                  <Button
                    type='frame'
                    color='storm'
                    label={t('Generate new')}
                    size='m'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'regenerate');
                    }}
                  />
                </bem.MFAOptions__buttons>
              </bem.MFAOptions__row>
            </bem.MFAOptions>
          )}

          {!this.state.isMfaActive && this.state.isMfaAvailable && this.state.dateDisabled && (
            <InlineMessage
              type='default'
              message={t(
                'Two-factor authentication was deactivated for your account on ##date##'
              ).replace('##date##', formatDate(this.state.dateDisabled))}
            />
          )}
        </bem.SecurityRow>
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
      </>
    );
  }
}
