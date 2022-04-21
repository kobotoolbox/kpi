import React from 'react'
import bem, {makeBem} from 'js/bem'
import { stores } from 'jsapp/js/stores'
import QRCode from 'qrcode.react'
import Button from 'js/components/common/button'
import TextBox from 'js/components/common/textBox'
import mfaActions, {
  MfaActivatedResponse,
  MfaBackupCodesResponse,
} from 'js/actions/mfaActions'

import './mfaModals.scss'

bem.MFAModals = makeBem(null, 'mfa-modal')
bem.MFAModals__step = makeBem(bem.MFAModals, 'step')
bem.MFAModals__helpEmail = makeBem(bem.MFAModals, 'email')

bem.MFAModals__title = makeBem(bem.MFAModals, 'title', 'h4')
bem.MFAModals__description = makeBem(bem.MFAModals, 'description')

bem.MFAModals__body = makeBem(bem.MFAModals, 'body')
bem.MFAModals__qr = makeBem(bem.MFAModals, 'qr')
bem.MFAModals__token = makeBem(bem.MFAModals, 'token')
bem.MFAModals__manual = makeBem(bem.MFAModals, 'manual')
bem.MFAModals__link = makeBem(bem.MFAModals, 'link', 'a')
bem.MFAModals__codes = makeBem(bem.MFAModals, 'codes')
bem.MFAModals__list = makeBem(bem.MFAModals, 'list', 'ul')
bem.MFAModals__listItem = makeBem(bem.MFAModals, 'item', 'li')
bem.MFAModals__linkwrapper = makeBem(bem.MFAModals, 'linkwrapper')

bem.MFAModals__footer = makeBem(bem.MFAModals, 'footer', 'footer')
bem.MFAModals__footerLeft = makeBem(bem.MFAModals, 'footer-left')
bem.MFAModals__footerRight = makeBem(bem.MFAModals, 'footer-right')

const SUPPORT_EMAIL = 'support@kobotoolbox.org'

type ModalSteps = 'qr' | 'backups' | 'manual' | 'token' | 'disclaimer' | 'help-text'

type MFAModalsProps = {
  onModalClose: Function
  qrCode?: string
  modalType: 'qr' | 'regenerate' | 'reconfigure' | 'deactivate'
}

type MFAModalsState = {
  currentStep: ModalSteps
  qrCode: null | string
  /** Currently input code, used for confirmCode */
  inputString: string
  backupCodes: null | string[]
  downloadClicked: boolean
  errorText: undefined | string
}

export default class MFAModals extends React.Component<
  MFAModalsProps,
  MFAModalsState
> {
  constructor(props: MFAModalsProps) {
    super(props)
    this.state = {
      qrCode: this.props.qrCode || null,
      currentStep: this.getInitalModalStep(),
      inputString: '',
      backupCodes: null,
      downloadClicked: false,
      errorText: undefined,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      mfaActions.activate.completed.listen(this.onMfaActivateCompleted.bind(this)),
      mfaActions.confirmCode.completed.listen(this.onMfaCodesReceived.bind(this)),
      mfaActions.regenerate.completed.listen(this.onMfaCodesReceived.bind(this)),
      mfaActions.deactivate.completed.listen(this.onMfaDeactivated.bind(this)),

      mfaActions.confirmCode.failed.listen(this.onCallFailed.bind(this)),
      mfaActions.regenerate.failed.listen(this.onCallFailed.bind(this)),
      mfaActions.deactivate.failed.listen(this.onCallFailed.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  onMfaActivateCompleted(response: MfaActivatedResponse) {
    this.setState({
      qrCode: response.details,
      currentStep: 'qr',
    })
  }

  mfaConfirm() {
    mfaActions.confirmCode(this.state.inputString)
  }

  onMfaCodesReceived(response: MfaBackupCodesResponse) {
    this.setState({
      backupCodes: response.backup_codes,
      currentStep: 'backups',
    })
  }

  mfaDeactivate() {
    mfaActions.deactivate(this.state.inputString)
  }

  onMfaDeactivated() {
    if (this.props.modalType === 'reconfigure') {
      mfaActions.activate(true)
    } else {
      this.closeModal()
    }
  }

  mfaRegenerate() {
    mfaActions.regenerate(this.state.inputString)
  }

  closeModal() {
    this.props.onModalClose()
  }

  // Only used for failed tokens
  onCallFailed() {
    this.setState({errorText: t('Incorrect token')})
  }

  getSecretKey(): string {
    // We expect backend to not change the way the secret key is returned
    const keyFromBackend = this.props.qrCode || this.state.qrCode

    if (keyFromBackend) {
      return (
        keyFromBackend.split('=')[1].split('&')[0]
      )
    } else {
      return (t('Could not generate secret key'))
    }
  }

  getInitalModalStep(): ModalSteps {
    switch (this.props.modalType) {
      case 'qr':
        return 'qr'
      case 'regenerate':
      case 'reconfigure':
        return 'disclaimer'
      case 'deactivate':
        return 'token'
    }
  }

  handleTokenSubmit() {
    this.setState({inputString: ''})

    switch (this.props.modalType) {
      case 'regenerate':
        this.mfaRegenerate()
        break
      case 'reconfigure':
        this.mfaDeactivate()
        break
      case 'deactivate':
        this.mfaDeactivate()
        break
    }
  }

  onInputChange(inputString: string) {
    this.setState({inputString: inputString})
  }

  changeStep(
    evt: React.ChangeEvent<HTMLInputElement>,
    newStep: ModalSteps
  ) {
    evt.preventDefault()

    this.setState({currentStep: newStep})
  }

  isTokenValid(): boolean {
    return this.state.inputString !== null && this.state.inputString.length === 6
  }

  downloadCodes() {
    if (this.state.backupCodes) {
      const USERNAME = stores.session.currentAccount.username
      // gets date in yyyymmdd
      const DATE = new Date().toJSON().slice(0, 10).replace(/-/g, '')

      const formatedCodes = this.state.backupCodes.map((t) => {
        return t + '\n'
      })
      const codesLink = document.createElement('a')
      const codesFile = new Blob(formatedCodes)

      codesLink.href = URL.createObjectURL(codesFile)
      codesLink.download = 'backups_' + USERNAME + '_' + DATE + '.txt'

      document.body.appendChild(codesLink)
      codesLink.click()

      this.setState({downloadClicked: true})
    }
  }

  // HACK FIX: since the header is seperate from the modal we do this
  // roundabout way of disabling the close icon
  disableCloseIcon() {
    const closeIcon = document.getElementsByClassName('modal__x')[0] as HTMLElement
    closeIcon.hidden = true
  }

  renderQRCodeStep() {
    return (
      <bem.MFAModals__step m='qr'>
        <bem.MFAModals__description>
          <p>
            {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We recommend enabling Two-factor Authenication for an additional layer of protection.')}
          </p>

          <strong>
            {t('Scan QR code and enter the six-digit token from the application')}
          </strong>
        </bem.MFAModals__description>

        <bem.MFAModals__body>
          <bem.MFAModals__qr>
            <QRCode
              value={this.state.qrCode || ''}
              size={170}
            />
          </bem.MFAModals__qr>

          <bem.MFAModals__token>
            <p>
              {t('After scanning the QR code image, the app will display a six-digit code that you can display below.')}
            </p>

            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
            />
            <bem.MFAModals__manual>
              {t('No QR code?')}

              &nbsp;

              <bem.MFAModals__link
                onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                  this.changeStep(evt, 'manual')
                }}
              >
                {t('Enter key manually')}
              </bem.MFAModals__link>
            </bem.MFAModals__manual>
          </bem.MFAModals__token>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footerRight>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={this.mfaConfirm.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModals__footerRight>
        </bem.MFAModals__footer>
      </bem.MFAModals__step>
    )
  }

  renderBackupStep() {
    this.disableCloseIcon()

    return (
      <bem.MFAModals__step m='backup'>
        <bem.MFAModals__description>
          <p>
            {t('The following recovery codes will help you access your account in case your authenticator fails. These codes are unique and fill not be stored in your KoBo account. Please download the file and keep it somewhere safe.')}
          </p>
        </bem.MFAModals__description>

        <bem.MFAModals__body>
          {this.state.backupCodes &&
            <bem.MFAModals__codes>
              <bem.MFAModals__list>
                {this.state.backupCodes.map((t) => {
                  return (
                    <bem.MFAModals__listItem>
                      <strong>
                        {t}
                      </strong>
                    </bem.MFAModals__listItem>
                  )
                })}
              </bem.MFAModals__list>
            </bem.MFAModals__codes>
          }
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footerLeft>
            <Button
              type='frame'
              color='blue'
              size='l'
              isFullWidth
              label={t('Download codes')}
              onClick={this.downloadCodes.bind(this)}
            />
          </bem.MFAModals__footerLeft>

          <bem.MFAModals__footerRight>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth
              label={t('I saved my codes')}
              onClick={this.closeModal.bind(this)}
              isDisabled={!this.state.downloadClicked}
            />
          </bem.MFAModals__footerRight>
        </bem.MFAModals__footer>
      </bem.MFAModals__step>
    )
  }

  renderManualStep() {
    return (
      <bem.MFAModals__step m='manual'>
        <bem.MFAModals__description>
          <p>
            {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We recommend enabling Two-factor Authenication for an additional layer of protection.')}
          </p>

          <strong>
            {t('Enter this key into your authentication app to generate a six digit token')}
          </strong>
        </bem.MFAModals__description>

        <bem.MFAModals__body>
          <bem.MFAModals__codes>
            {this.getSecretKey()}
          </bem.MFAModals__codes>

          <bem.MFAModals__token>
            <p>
              {t('Once your authentication app is set up, generate a temporary six digit token and enter it in the field below.')}
            </p>

            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
            />
            <bem.MFAModals__manual>
              <bem.MFAModals__link
                onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                  this.changeStep(evt, 'qr')
                }}
              >
                {t('Take me back to QR code')}
              </bem.MFAModals__link>
            </bem.MFAModals__manual>
          </bem.MFAModals__token>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footerRight>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={this.mfaConfirm.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModals__footerRight>
        </bem.MFAModals__footer>
      </bem.MFAModals__step>
    )
  }

  renderTokenStep() {
    return (
      <bem.MFAModals__step m='token'>
        <bem.MFAModals__body>
          <bem.MFAModals__token>
            <strong>
              {/*This is safe as this step only shows if not on qr step*/}
              {this.props.modalType === 'regenerate' &&
                t('Please enter your six-digit authenticator token to regenerate your backup codes.')
              }

              {this.props.modalType != 'regenerate' &&
                t('Please enter your six-digit authenticator token to deactivate two-factor authentication.')
              }
            </strong>

            <bem.MFAModals__linkwrapper>
              <TextBox
                errors={this.state.errorText}
                value={this.state.inputString}
                onChange={this.onInputChange.bind(this)}
                customModifiers={'on-white'}
              />

              <bem.MFAModals__link
                onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                  this.changeStep(evt, 'help-text')
                }}
              >
                {t('Problems with the token')}
              </bem.MFAModals__link>
            </bem.MFAModals__linkwrapper>
          </bem.MFAModals__token>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footerRight>
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
          </bem.MFAModals__footerRight>
        </bem.MFAModals__footer>
      </bem.MFAModals__step>
    )
  }

  renderDisclaimerStep() {
    return (
      <bem.MFAModals__step
        m={{
          regenerate: this.props.modalType === 'regenerate',
          disclaimer: true
        }}
      >
        <bem.MFAModals__body>
          <strong>
            {/*This is safe as this step only shows if on reconfigure or regenerate*/}
            {this.props.modalType === 'regenerate' &&
              t('Please note that recovery codes from the previous set up will not be valid anymore')
            }

            {this.props.modalType != 'regenerate' &&
              t('Please note that in order to reconfigure two-factor authentication (2FA), the previous set up will need to be deleted. Tokens or recovery codes from the previous set up will not be valid anymore')
            }
          </strong>

          {this.props.modalType === 'reconfigure' &&
            <p>
              {t("Once your 2FA has been deactivated, you'll be prompted to configure it again. If you cannot complete the process. two-factor authentication will remain disabled for your account. In this case, you can reenable it at any time through the usual process.")}
            </p>
          }
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footerRight>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'token')
              }}
            />
          </bem.MFAModals__footerRight>
        </bem.MFAModals__footer>
      </bem.MFAModals__step>
    )
  }

  renderHelpTextStep() {
    return (
      <bem.MFAModals__step m='help-text'>
        <bem.MFAModals__body>
          <strong>
            {t('Issues with the token')}
          </strong>

          <p>
            {t('If you have problems with your verification token, please try the following')}
          </p>

          <bem.MFAModals__list>
            <bem.MFAModals__listItem>
              {t('Double check you are using the token generator for the right instance of KoBoToolbox')}
            </bem.MFAModals__listItem>

            <bem.MFAModals__listItem>
              {t('Try using one of your back up security codes instead')}
            </bem.MFAModals__listItem>
          </bem.MFAModals__list>

          <bem.MFAModals__helpEmail>
            <p>
              {t('If you are still experiencing issues logging in, or have lost your device and recovery codes, please send an email to')}
            </p>

              &nbsp;

            <bem.MFAModals__link href={'mailto:' + SUPPORT_EMAIL}>
              {SUPPORT_EMAIL}
            </bem.MFAModals__link>

              &nbsp;

            <p>
              {t('with the subject "2FA issues"')}
            </p>
          </bem.MFAModals__helpEmail>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footerLeft>
            <Button
              type='frame'
              color='blue'
              size='l'
              isFullWidth
              label={t('Back')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'token')
              }}
            />
          </bem.MFAModals__footerLeft>

          <bem.MFAModals__footerRight>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth
              label={t('OK')}
              onClick={this.closeModal.bind(this)}
            />
          </bem.MFAModals__footerRight>
        </bem.MFAModals__footer>
      </bem.MFAModals__step>
    )
  }

  render() {
    // qrCode is mandatory if modalType is qr
    if (!this.props.qrCode && this.props.modalType === 'qr') {
      throw new Error(t('Modal is expecting a qr code but did not recieve any'))
    }

    return (
      <bem.MFAModals>
        {(this.state.currentStep === 'qr') &&
          this.renderQRCodeStep()
        }

        {(this.state.currentStep === 'backups') &&
          this.renderBackupStep()
        }

        {(this.state.currentStep === 'manual') &&
          this.renderManualStep()
        }

        {(this.state.currentStep === 'token') &&
          this.renderTokenStep()
        }

        {(this.state.currentStep === 'disclaimer') &&
          this.renderDisclaimerStep()
        }

        {(this.state.currentStep === 'help-text') &&
          this.renderHelpTextStep()
        }
      </bem.MFAModals>
    )
  }
}
