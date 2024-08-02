import React from 'react';
import bem, {makeBem} from 'js/bem';
import {observer} from 'mobx-react';
import sessionStore from 'js/stores/session';
import QRCode from 'qrcode.react';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import type {
  MfaActivatedResponse,
  MfaBackupCodesResponse,
} from 'js/actions/mfaActions';
import mfaActions from 'js/actions/mfaActions';
import {currentLang} from 'js/utils';
import envStore from 'js/envStore';
import './mfaModals.scss';

bem.MFAModal = makeBem(null, 'mfa-modal');

bem.MFAModal__p = makeBem(bem.MFAModal, 'p', 'div');

bem.MFAModal__title = makeBem(bem.MFAModal, 'title', 'h4');
bem.MFAModal__description = makeBem(bem.MFAModal, 'description');

bem.MFAModal__body = makeBem(bem.MFAModal, 'body');
bem.MFAModal__helpLink = makeBem(bem.MFAModal, 'help-link', 'a');
bem.MFAModal__qrcodeWrapper = makeBem(bem.MFAModal, 'qrcode-wrapper');
bem.MFAModal__codes = makeBem(bem.MFAModal, 'codes');
bem.MFAModal__codesWrapper = makeBem(bem.MFAModal, 'codes-wrapper');
bem.MFAModal__list = makeBem(bem.MFAModal, 'list', 'ul');

bem.MFAModal__footer = makeBem(bem.MFAModal, 'footer', 'footer');
bem.MFAModal__footerLeft = makeBem(bem.MFAModal, 'footer-left');
bem.MFAModal__footerRight = makeBem(bem.MFAModal, 'footer-right');

type ModalSteps = 'backups' | 'disclaimer' | 'help' | 'manual' | 'qr' | 'token';

interface MFAModalsProps {
  onModalClose: Function;
  qrCode?: string;
  modalType: 'deactivate' | 'qr' | 'reconfigure' | 'regenerate';
}

interface MFAModalsState {
  currentStep: ModalSteps;
  qrCode: string | null;
  /** Currently input code, used for confirmCode */
  inputString: string;
  backupCodes: string[] | null;
  downloadClicked: boolean;
  errorText: string | undefined;
}

const MFAModals = class MFAModals extends React.Component<
  MFAModalsProps,
  MFAModalsState
> {
  constructor(props: MFAModalsProps) {
    super(props);
    this.state = {
      qrCode: this.props.qrCode || null,
      currentStep: this.getInitalModalStep(),
      inputString: '',
      backupCodes: null,
      downloadClicked: false,
      errorText: undefined,
    };
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      mfaActions.activate.completed.listen(
        this.onMfaActivateCompleted.bind(this)
      ),
      mfaActions.confirmCode.completed.listen(
        this.onMfaCodesReceived.bind(this)
      ),
      mfaActions.regenerate.completed.listen(
        this.onMfaCodesReceived.bind(this)
      ),
      mfaActions.deactivate.completed.listen(this.onMfaDeactivated.bind(this)),

      mfaActions.confirmCode.failed.listen(this.onCallFailed.bind(this)),
      mfaActions.regenerate.failed.listen(this.onCallFailed.bind(this)),
      mfaActions.deactivate.failed.listen(this.onCallFailed.bind(this))
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onMfaActivateCompleted(response: MfaActivatedResponse) {
    this.setState({
      qrCode: response.details,
      currentStep: 'qr',
      errorText: undefined,
    });
  }

  mfaConfirm() {
    mfaActions.confirmCode(this.state.inputString);
  }

  onMfaCodesReceived(response: MfaBackupCodesResponse) {
    this.setState({
      backupCodes: response.backup_codes,
      currentStep: 'backups',
      errorText: undefined,
    });
  }

  mfaDeactivate() {
    mfaActions.deactivate(this.state.inputString);
  }

  onMfaDeactivated() {
    this.setState({errorText: undefined});
    if (this.props.modalType === 'reconfigure') {
      mfaActions.activate(true);
    } else {
      this.closeModal();
    }
  }

  mfaRegenerate() {
    mfaActions.regenerate(this.state.inputString);
  }

  closeModal() {
    this.props.onModalClose();
  }

  // Only used for failed tokens
  onCallFailed() {
    this.setState({errorText: t('Incorrect token')});
  }

  getSecretKey(): string {
    // We expect backend to not change the way the secret key is returned
    const keyFromBackend = this.props.qrCode || this.state.qrCode;

    if (keyFromBackend) {
      return keyFromBackend.split('=')[1].split('&')[0];
    } else {
      return t('Could not generate secret key');
    }
  }

  getInitalModalStep(): ModalSteps {
    switch (this.props.modalType) {
      case 'qr':
        return 'qr';
      case 'regenerate':
      case 'reconfigure':
        return 'disclaimer';
      case 'deactivate':
        return 'token';
    }
  }

  onSubmit() {
    this.setState({inputString: ''});

    switch (this.props.modalType) {
      case 'regenerate':
        this.mfaRegenerate();
        break;
      case 'reconfigure':
        this.mfaDeactivate();
        break;
      case 'deactivate':
        this.mfaDeactivate();
        break;
    }
  }

  onInputChange(inputString: string) {
    this.setState({inputString: inputString});
  }

  changeStep(evt: React.ChangeEvent<HTMLInputElement>, newStep: ModalSteps) {
    evt.preventDefault();
    this.setState({currentStep: newStep});
  }

  isTokenValid() {
    return (
      this.state.inputString !== null && this.state.inputString.length >= 1
    );
  }

  downloadCodes() {
    if (this.state.backupCodes) {
      const USERNAME = sessionStore.currentAccount.username;
      // gets date in yyyymmdd
      const DATE = new Date().toJSON().slice(0, 10).replace(/-/g, '');

      const formatedCodes = this.state.backupCodes.map((t) => t + '\n');
      const codesLink = document.createElement('a');
      const codesFile = new Blob(formatedCodes);

      codesLink.href = URL.createObjectURL(codesFile);
      codesLink.download = 'backups_' + USERNAME + '_' + DATE + '.txt';

      document.body.appendChild(codesLink);
      codesLink.click();

      this.setState({downloadClicked: true});
    }
  }

  // HACK FIX: since the header is seperate from the modal we do this
  // roundabout way of disabling the close icon
  disableCloseIcon() {
    const closeIcon = document.getElementsByClassName(
      'modal__x'
    )[0] as HTMLElement;
    closeIcon.hidden = true;
  }

  renderIntroText() {
    return (
      <bem.MFAModal__p>
        {t(
          'Two-factor authentication (2FA) verifies your identity using an authenticator application in addition to your usual password. ' +
            'We recommend enabling two-factor authentication for an additional layer of protection.'
        )}
      </bem.MFAModal__p>
    );
  }

  renderQRCodeStep() {
    return (
      <bem.MFAModal m='step-qr'>
        <bem.MFAModal__description>
          {this.renderIntroText()}
          <bem.MFAModal__p>
            <strong>
              {t(
                'Scan QR code and enter the ##number##-digit token from the application'
              ).replace('##number##', String(envStore.data.mfa_code_length))}
            </strong>
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          <bem.MFAModal__qrcodeWrapper>
            <QRCode value={this.state.qrCode || ''} size={170} />
          </bem.MFAModal__qrcodeWrapper>

          <bem.MFAModal__p>
            {t(
              'After scanning the QR code image, the authenticator app will display a ##number##-digit code that you can enter below.'
            ).replace('##number##', String(envStore.data.mfa_code_length))}
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <TextBox
              className='mfa-modals-textbox'
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              disableAutocomplete
            />
          </bem.MFAModal__p>

          <bem.MFAModal__p m='align-right'>
            {t('No QR code?')}
            &nbsp;
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'manual');
              }}
            >
              {t('Enter key manually')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={this.mfaConfirm.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    );
  }

  renderBackupStep() {
    this.disableCloseIcon();

    return (
      <bem.MFAModal m='step-backup'>
        <bem.MFAModal__description>
          <bem.MFAModal__p>
            {t(
              'The following recovery codes will help you access your account in case your authenticator app fails. These codes are unique and will not be stored in your Kobo account. ' +
                'This is your only opportunity to save them. Please download the file and keep it somewhere safe.'
            )}
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          {this.state.backupCodes && (
            <bem.MFAModal__codesWrapper>
              <bem.MFAModal__codes>
                <bem.MFAModal__list>
                  {this.state.backupCodes.map((backupCode, index) => (
                    <li key={index}>
                      <strong>{backupCode}</strong>
                    </li>
                  ))}
                </bem.MFAModal__list>
              </bem.MFAModal__codes>
            </bem.MFAModal__codesWrapper>
          )}
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerLeft>
            <Button
              type='secondary'
              size='l'
              isFullWidth
              label={t('Download codes')}
              onClick={this.downloadCodes.bind(this)}
            />
          </bem.MFAModal__footerLeft>

          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('I saved my codes')}
              onClick={this.closeModal.bind(this)}
              isDisabled={!this.state.downloadClicked}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    );
  }

  renderManualStep() {
    return (
      <bem.MFAModal m='step-manual'>
        <bem.MFAModal__description>
          <bem.MFAModal__p>{this.renderIntroText()}</bem.MFAModal__p>

          <bem.MFAModal__p>
            <strong>
              {t(
                'Enter this key into your authenticator app to generate a ##number##-digit token'
              ).replace('##number##', String(envStore.data.mfa_code_length))}
            </strong>
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          <bem.MFAModal__codesWrapper>
            <bem.MFAModal__codes>{this.getSecretKey()}</bem.MFAModal__codes>
          </bem.MFAModal__codesWrapper>

          <bem.MFAModal__p>
            {t(
              'Once your authenticator app is set up, generate a ##number##-digit token and enter it in the field below.'
            ).replace('##number##', String(envStore.data.mfa_code_length))}
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <TextBox
              className='mfa-modals-textbox'
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              disableAutocomplete
            />
          </bem.MFAModal__p>

          <bem.MFAModal__p m='align-right'>
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'qr');
              }}
            >
              {t('Take me back to QR code')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={this.mfaConfirm.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    );
  }

  renderTokenStep() {
    return (
      <bem.MFAModal m='step-token'>
        <bem.MFAModal__body>
          <bem.MFAModal__p>
            <strong>
              {/*This is safe as this step only shows if not on qr step*/}
              {this.props.modalType === 'regenerate' &&
                t(
                  'Please enter your ##number##-digit authenticator token to regenerate your backup codes.'
                ).replace('##number##', String(envStore.data.mfa_code_length))}

              {this.props.modalType !== 'regenerate' &&
                t(
                  'Please enter your ##number##-digit authenticator token to deactivate two-factor authentication.'
                ).replace('##number##', String(envStore.data.mfa_code_length))}
            </strong>
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <TextBox
              className='mfa-modals-textbox'
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              disableAutocomplete
            />
          </bem.MFAModal__p>

          <bem.MFAModal__p m='align-right'>
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'help');
              }}
            >
              {t('Problems with your token?')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={this.onSubmit.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    );
  }

  renderDisclaimerStep() {
    return (
      <bem.MFAModal
        m={{
          regenerate: this.props.modalType === 'regenerate',
          disclaimer: true,
        }}
      >
        <bem.MFAModal__body>
          <bem.MFAModal__p>
            <strong>
              {/*This is safe as this step only shows if on reconfigure or regenerate*/}
              {this.props.modalType === 'regenerate' &&
                t(
                  'Please note that generating new recovery codes will invalidate any previously generated codes.'
                )}

              {this.props.modalType !== 'regenerate' &&
                t(
                  'Please note that in order to reconfigure two-factor authentication (2FA), the previous set up will first be deleted. Tokens or recovery codes from the previous set up will not be valid anymore.'
                )}
            </strong>
          </bem.MFAModal__p>

          {this.props.modalType === 'reconfigure' && (
            <bem.MFAModal__p>
              {t(
                "Once your current 2FA has been deactivated, you'll be prompted to configure it again. If you cannot complete the process, 2FA will remain disabled for your account. " +
                  'In this case, you can enable it again at any time through the usual process.'
              )}
            </bem.MFAModal__p>
          )}
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'token');
              }}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    );
  }

  renderHelpStep() {
    return (
      <bem.MFAModal m='step-help'>
        <bem.MFAModal__body>
          <bem.MFAModal__p>
            <strong>{t('Issues with the token')}</strong>
          </bem.MFAModal__p>

          <bem.MFAModal__p
            dangerouslySetInnerHTML={{
              __html: envStore.data.mfa_localized_help_text,
            }}
          />
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerLeft>
            <Button
              type='secondary'
              size='l'
              isFullWidth
              label={t('Back')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'token');
              }}
            />
          </bem.MFAModal__footerLeft>

          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('OK')}
              onClick={this.closeModal.bind(this)}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    );
  }

  render() {
    // qrCode is mandatory if modalType is qr
    if (!this.props.qrCode && this.props.modalType === 'qr') {
      throw new Error('Modal is expecting a qr code but did not recieve any');
    }

    switch (this.state.currentStep) {
      case 'qr':
        return this.renderQRCodeStep();
      case 'backups':
        return this.renderBackupStep();
      case 'manual':
        return this.renderManualStep();
      case 'token':
        return this.renderTokenStep();
      case 'disclaimer':
        return this.renderDisclaimerStep();
      case 'help':
        return this.renderHelpStep();
      default:
        return null;
    }
  }
};

export default (observer as any)(MFAModals);
