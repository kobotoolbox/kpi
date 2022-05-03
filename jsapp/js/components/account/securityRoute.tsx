import React from 'react';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Icon from 'js/components/common/icon';
import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from 'js/stores';
import type {
  MfaUserMethodsResponse,
  MfaActiveResponse,
  MfaActivatedResponse,
} from 'js/actions/mfaActions';
import mfaActions from 'js/actions/mfaActions';
import {MODAL_TYPES} from 'jsapp/js/constants';
import envStore from 'js/envStore';
import './securityRoute.scss';
import {formatDate} from 'js/utils';

bem.SecuritySection = makeBem(null, 'security-section');

bem.SecurityRow = makeBem(null, 'security-row');
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header');
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title', 'h2');
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons');
bem.SecurityRow__description = makeBem(bem.SecurityRow, 'description');

bem.MFAOptions = makeBem(null, 'mfa-options');
bem.MFAOptions__row = makeBem(bem.MFAOptions, 'row');
bem.MFAOptions__label = makeBem(bem.MFAOptions, 'label');
bem.MFAOptions__buttons = makeBem(bem.MFAOptions, 'row');

bem.TableMediaPreviewHeader = makeBem(null, 'table-media-preview-header');
bem.TableMediaPreviewHeader__title = makeBem(bem.TableMediaPreviewHeader, 'title', 'div');

interface SecurityState {
  isMfaActive: boolean;
  dateDisabled?: string;
}

type EditModalTypes = 'reconfigure' | 'regenerate';

export default class SecurityRoute extends React.Component<
  {},
  SecurityState
> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isMfaActive: false,
      dateDisabled: undefined,
    };
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      mfaActions.getUserMethods.completed.listen(this.onGetUserMethodsCompleted.bind(this)),
      mfaActions.isActive.completed.listen(this.onIsActiveCompleted.bind(this)),
      mfaActions.activate.completed.listen(this.mfaActivating.bind(this)),
      mfaActions.confirmCode.completed.listen(this.mfaActivated.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this)),
    );

    mfaActions.isActive();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onGetUserMethodsCompleted(response: MfaUserMethodsResponse) {
    this.setState({dateDisabled: response[0].date_disabled});
  }

  onIsActiveCompleted(response: MfaActiveResponse) {
    const isActive = response.length >= 1;

    if (isActive) {
      this.setState({
        isMfaActive: isActive,
        dateDisabled: undefined,
      });
    } else {
      this.setState({isMfaActive: isActive});
      mfaActions.getUserMethods();
    }
  }

  mfaActivating(response: MfaActivatedResponse) {
    if (response && !response.inModal) {
      stores.pageState.showModal({
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
    if (isActive) {
      mfaActions.activate();
    } else {
      stores.pageState.showModal({
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

    stores.pageState.showModal({
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
          <Icon name='lock'size='s'/>
          {t('Two-factor authentication')}
        </bem.TableMediaPreviewHeader__title>
      </bem.TableMediaPreviewHeader>
    );
  }

  render() {
    if (!envStore.isReady) {
      return <LoadingSpinner/>;
    }

    if (!envStore.data.mfa_enabled) {
      return null;
    }

    return (
      <bem.SecuritySection>
        <bem.SecurityRow>
          <bem.SecurityRow__header>
            <bem.SecurityRow__title>
              {t('Two-factor authentication')}
            </bem.SecurityRow__title>

            <bem.SecurityRow__buttons>
              <ToggleSwitch
                label={this.state.isMfaActive ? t('Enabled') : t('Disabled')}
                checked={this.state.isMfaActive}
                onChange={this.onToggleChange.bind(this)}
              />
            </bem.SecurityRow__buttons>
          </bem.SecurityRow__header>

          <bem.SecurityRow__description>
            {t('Two-factor authentication (2FA) is an added layer of security used when logging into the platform. We recommend enabling Two-factor authentication for an additional layer of protection.')}
          </bem.SecurityRow__description>

          {this.state.isMfaActive &&
            <bem.MFAOptions>
              <bem.MFAOptions__row>
                <bem.MFAOptions__label>
                  {t('Authenticator app')}
                </bem.MFAOptions__label>

                <bem.MFAOptions__buttons>
                  {/*Put date last configured here*/}
                  <Button
                    type='frame'
                    color='storm'
                    label={t('Reconfigure')}
                    size='l'
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
                    size='l'
                    onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                      this.showEditModal(evt, 'regenerate');
                    }}
                  />
                </bem.MFAOptions__buttons>
              </bem.MFAOptions__row>
            </bem.MFAOptions>
          }

          {!this.state.isMfaActive && this.state.dateDisabled &&
            <InlineMessage
              type='default'
              message={t('Two-factor authentication was deactivated for your account on the ##date##').replace('##date##', formatDate(this.state.dateDisabled))}
            />
          }
        </bem.SecurityRow>
      </bem.SecuritySection>
    );
  }
}
