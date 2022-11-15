import React, {useState} from 'react';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Icon from 'js/components/common/icon';
import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from 'js/stores';
import type {
  MfaUserMethodsResponse,
  MfaActivatedResponse,
} from 'js/actions/mfaActions';
import mfaActions from 'js/actions/mfaActions';
import {MODAL_TYPES} from 'jsapp/js/constants';
import envStore from 'js/envStore';
import './securityRoute.scss';
import styles from './fun.module.scss';
import {formatTime, formatDate} from 'js/utils';

bem.SecuritySection = makeBem(null, 'security-section');

bem.SecurityRow = makeBem(null, 'security-row');
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header');
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title', 'h2');
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons');
bem.SecurityRow__description = makeBem(bem.SecurityRow, 'description');

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
  isMfaActive: boolean;
  dateDisabled?: string;
  dateModified?: string;
}

type EditModalTypes = 'reconfigure' | 'regenerate';


// mfaActions.getUserMethods.listen(() => {
//   $.ajax({
//     dataType: 'json',
//     method: 'GET',
//     url: `${ROOT_URL}/api/v2/auth/mfa/user-methods/`,
//   })
//     .done((response: MfaUserMethodsResponse) => {
//       mfaActions.getUserMethods.completed(response);
//     })
//     .fail((response: MfaErrorResponse) => {
//       let errorText = t('An error occured');
//       if (response.non_field_errors) {
//         errorText = response.non_field_errors;
//       }
//       notify(errorText, 'error');
//       mfaActions.getUserMethods.failed(response);
//     });
// });

export default function SecurityRoute() {
  const [state, setState] = useState({
    isMfaActive: false,
    dateDisabled: undefined,
    dateModified: undefined,
  });
  const onToggleChange = (isActive: boolean) => {
    console.log("click", isActive)
    if (isActive) {
      mfaActions.activate();
    } else {
      stores.pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        modalType: 'deactivate',
        // customModalHeader: this.renderCustomHeader(),
        disableBackdropClose: true,
        disableEscClose: true,
      });
    }
  };
  return (
    <bem.SecuritySection>
      <bem.SecurityRow>
        <bem.SecurityRow__header>
          <h2 className={styles.aqua}> Hi </h2>
          <bem.SecurityRow__title>
            {t('Two-factor authentication')}
          </bem.SecurityRow__title>
          <bem.SecurityRow__buttons>
            <ToggleSwitch
              label={state.isMfaActive ? t('Enabled') : t('Disabled')}
              checked={state.isMfaActive}
              onChange={onToggleChange}
            />
          </bem.SecurityRow__buttons>
        </bem.SecurityRow__header>
        <bem.SecurityRow__description>
          {t(
            'Two-factor authenication (2FA) verifies your identity using an authenticator application in addition to your usual password. ' +
              'We recommend enabling two-factor authenication for an additional layer of protection.'
          )}
        </bem.SecurityRow__description>
      </bem.SecurityRow>
    </bem.SecuritySection>
  );
}

class _SecurityRoute extends React.Component<{}, SecurityState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isMfaActive: false,
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
      mfaActions.activate.completed.listen(this.mfaActivating.bind(this)),
      mfaActions.confirmCode.completed.listen(this.mfaActivated.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this))
    );

    mfaActions.getUserMethods();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onGetUserMethodsCompleted(response: MfaUserMethodsResponse) {
    this.setState({
      isMfaActive: response[0].is_active,
      dateDisabled: response[0].date_disabled,
      dateModified: response[0].date_modified,
    });
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
          <Icon name='lock' size='s' />
          {t('Two-factor authentication')}
        </bem.TableMediaPreviewHeader__title>
      </bem.TableMediaPreviewHeader>
    );
  }

  render() {
    if (!envStore.isReady) {
      return <LoadingSpinner />;
    }

    if (!envStore.data.mfa_enabled) {
      return null;
    }

    return (
      <bem.SecuritySection>
        <bem.SecurityRow>
          {this.state.isMfaActive && (
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
          )}

          {!this.state.isMfaActive && this.state.dateDisabled && (
            <InlineMessage
              type='default'
              message={t(
                'Two-factor authentication was deactivated for your account on ##date##'
              ).replace('##date##', formatDate(this.state.dateDisabled))}
            />
          )}
        </bem.SecurityRow>
      </bem.SecuritySection>
    );
  }
}
