import React from 'react';
import bem, {makeBem} from 'js/bem';
import {stores} from 'jsapp/js/stores';
import QRCode from 'qrcode.react';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import type {
  MfaActivatedResponse,
  MfaBackupCodesResponse,
} from 'js/actions/mfaActions';
import mfaActions from 'js/actions/mfaActions';

import './mfaModals.scss';

bem.MFAModal = makeBem(null, 'mfa-modal');

bem.MFAModal__p = makeBem(bem.MFAModal, 'p', 'p');

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

const SUPPORT_EMAIL = 'support@kobotoolbox.org';

type ModalSteps = 'backups' | 'disclaimer' | 'help-text' | 'manual' | 'qr' | 'token';

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

export default class MFAModals extends React.Component<
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
      mfaActions.activate.completed.listen(this.onMfaActivateCompleted.bind(this)),
      mfaActions.confirmCode.completed.listen(this.onMfaCodesReceived.bind(this)),
      mfaActions.regenerate.completed.listen(this.onMfaCodesReceived.bind(this)),
      mfaActions.deactivate.completed.listen(this.onMfaDeactivated.bind(this)),

      mfaActions.confirmCode.failed.listen(this.onCallFailed.bind(this)),
      mfaActions.regenerate.failed.listen(this.onCallFailed.bind(this)),
      mfaActions.deactivate.failed.listen(this.onCallFailed.bind(this)),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onMfaActivateCompleted(response: MfaActivatedResponse) {
    this.setState({
      qrCode: response.details,
      currentStep: 'qr',
    });
  }

  mfaConfirm() {
    mfaActions.confirmCode(this.state.inputString);
  }

  onMfaCodesReceived(response: MfaBackupCodesResponse) {
    this.setState({
      backupCodes: response.backup_codes,
      currentStep: 'backups',
    });
  }

  mfaDeactivate() {
    mfaActions.deactivate(this.state.inputString);
  }

  onMfaDeactivated() {
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
      return (
        keyFromBackend.split('=')[1].split('&')[0]
      );
    } else {
      return (t('Could not generate secret key'));
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

  handleTokenSubmit() {
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

  changeStep(
    evt: React.ChangeEvent<HTMLInputElement>,
    newStep: ModalSteps
  ) {
    evt.preventDefault();

    this.setState({currentStep: newStep});
  }

  isTokenValid(): boolean {
    return this.state.inputString !== null && this.state.inputString.length === 6;
  }

  downloadCodes() {
    if (this.state.backupCodes) {
      const USERNAME = stores.session.currentAccount.username;
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
    const closeIcon = document.getElementsByClassName('modal__x')[0] as HTMLElement;
    closeIcon.hidden = true;
  }

  renderQRCodeStep() {
    return (
      <bem.MFAModal m='step-qr'>
        <bem.MFAModal__description>
          <bem.MFAModal__p>
            {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We recommend enabling Two-factor Authenication for an additional layer of protection.')}
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <strong>
              {t('Scan QR code and enter the six-digit token from the application')}
            </strong>
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          <bem.MFAModal__qrcodeWrapper>
            <QRCode
              value={this.state.qrCode || ''}
              size={170}
            />
          </bem.MFAModal__qrcodeWrapper>

          <bem.MFAModal__p>
            {t('After scanning the QR code image, the app will display a six-digit code that you can display below.')}
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
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
              type='full'
              color='blue'
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
            {t('The following recovery codes will help you access your account in case your authenticator fails. These codes are unique and fill not be stored in your KoBo account. Please download the file and keep it somewhere safe.')}
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          {this.state.backupCodes &&
            <bem.MFAModal__codesWrapper>
              <bem.MFAModal__codes>
                <bem.MFAModal__list>
                  {this.state.backupCodes.map((t) => (
                      <li>
                        <strong>
                          {t}
                        </strong>
                      </li>
                    ))}
                </bem.MFAModal__list>
              </bem.MFAModal__codes>
            </bem.MFAModal__codesWrapper>
          }
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerLeft>
            <Button
              type='frame'
              color='blue'
              size='l'
              isFullWidth
              label={t('Download codes')}
              onClick={this.downloadCodes.bind(this)}
            />
          </bem.MFAModal__footerLeft>

          <bem.MFAModal__footerRight>
            <Button
              type='full'
              color='blue'
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
          <bem.MFAModal__p>
            {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We recommend enabling Two-factor Authenication for an additional layer of protection.')}
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <strong>
              {t('Enter this key into your authentication app to generate a six digit token')}
            </strong>
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          <bem.MFAModal__codesWrapper>
            <bem.MFAModal__codes>
              {this.getSecretKey()}
            </bem.MFAModal__codes>
          </bem.MFAModal__codesWrapper>

          <bem.MFAModal__p>
            {t('Once your authentication app is set up, generate a temporary six digit token and enter it in the field below.')}
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
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
              type='full'
              color='blue'
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
                t('Please enter your six-digit authenticator token to regenerate your backup codes.')
              }

              {this.props.modalType !== 'regenerate' &&
                t('Please enter your six-digit authenticator token to deactivate two-factor authentication.')
              }
            </strong>
          </bem.MFAModal__p>

          <bem.MFAModal__p>
            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
            />
          </bem.MFAModal__p>

          <bem.MFAModal__p m='align-right'>
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'help-text');
              }}
            >
              {t('Problems with the token')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={
                this.handleTokenSubmit.bind(this)
              }
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
                t('Please note that recovery codes from the previous set up will not be valid anymore')
              }

              {this.props.modalType !== 'regenerate' &&
                t('Please note that in order to reconfigure two-factor authentication (2FA), the previous set up will need to be deleted. Tokens or recovery codes from the previous set up will not be valid anymore')
              }
            </strong>
          </bem.MFAModal__p>

          {this.props.modalType === 'reconfigure' &&
            <bem.MFAModal__p>
              {t("Once your 2FA has been deactivated, you'll be prompted to configure it again. If you cannot complete the process. two-factor authentication will remain disabled for your account. In this case, you can reenable it at any time through the usual process.")}
            </bem.MFAModal__p>
          }
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='full'
              color='blue'
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

  renderHelpTextStep() {
    return (
      <bem.MFAModal m='step-help-text'>
        <bem.MFAModal__body>
          <bem.MFAModal__p><strong>{t('Issues with the token')}</strong></bem.MFAModal__p>

          <bem.MFAModal__p>
            {t('If you have problems with your verification token, please try the following')}
          </bem.MFAModal__p>

          <bem.MFAModal__list>
            <li>
              {t('Double check you are using the token generator for the right instance of KoBoToolbox')}
            </li>

            <li>
              {t('Try using one of your back up security codes instead')}
            </li>
          </bem.MFAModal__list>

          <bem.MFAModal__p>
            {t('If you are still experiencing issues logging in, or have lost your device and recovery codes, please send an email to')}

            &nbsp;

            <bem.MFAModal__helpLink href={'mailto:' + SUPPORT_EMAIL}>
              {SUPPORT_EMAIL}
            </bem.MFAModal__helpLink>

            &nbsp;

            {t('with the subject "2FA issues"')}
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerLeft>
            <Button
              type='frame'
              color='blue'
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
              type='full'
              color='blue'
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
      throw new Error(t('Modal is expecting a qr code but did not recieve any'));
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
      case 'help-text':
        return this.renderHelpTextStep();
      default:
        return null;
    }
  }
}
