import React from 'react'
import bem, {makeBem} from 'js/bem'
import { stores } from 'jsapp/js/stores'
import QRCode from 'qrcode.react'
import Button from 'js/components/common/button'
import TextBox from 'js/components/common/textBox'
import mfaActions, {
  mfaActivatedResponse,
  mfaBackupCodesResponse,
} from 'js/actions/mfaActions'

import './mfaModals.scss'

bem.MFAModals = makeBem(null, 'mfa-modal')
bem.MFAModals__qrstep = makeBem(bem.MFAModals, 'qrstep')
bem.MFAModals__backupstep = makeBem(bem.MFAModals, 'backupstep')
bem.MFAModals__manualstep = makeBem(bem.MFAModals, 'manualstep')
bem.MFAModals__tokenstep = makeBem(bem.MFAModals, 'tokenstep')
bem.MFAModals__disclaimerstep = makeBem(bem.MFAModals, 'disclaimerstep')

bem.MFAModals__title = makeBem(bem.MFAModals, 'title', 'h4')
bem.MFAModals__description = makeBem(bem.MFAModals, 'description')

bem.MFAModals__body = makeBem(bem.MFAModals, 'body')
bem.MFAModals__qr = makeBem(bem.MFAModals, 'qr')
bem.MFAModals__token = makeBem(bem.MFAModals, 'token')
bem.MFAModals__manual = makeBem(bem.MFAModals, 'manual')
bem.MFAModals__manual__link = makeBem(bem.MFAModals__token, 'manual__link', 'a')
bem.MFAModals__codes = makeBem(bem.MFAModals, 'codes')
bem.MFAModals__list = makeBem(bem.MFAModals__codes, 'item', 'ul')
bem.MFAModals__list__item = makeBem(bem.MFAModals__codes, 'item', 'li')

bem.MFAModals__footer = makeBem(bem.MFAModals, 'footer', 'footer')
bem.MFAModals__footer__left = makeBem(bem.MFAModals__footer, 'footer-left')
bem.MFAModals__footer__right = makeBem(bem.MFAModals__footer, 'footer-right')

type modalSteps = 'qr' | 'backups' | 'manual' | 'token' | 'disclaimer'

type MFAModalsProps = {
  onModalClose: Function,
  qrCode?: string,
  modalType: 'qr' | 'regenerate' | 'reconfigure' | 'deactivate'
}

type MFAModalsState = {
  isLoading: boolean,
  currentStep: modalSteps,
  qrCode: null | string,
  inputString: string,
  backupCodes: null | string[],
  downloadClicked: boolean,
  errorText: undefined | string,
}

export default class MFAModals extends React.Component<
  MFAModalsProps,
  MFAModalsState
> {
  constructor(props: MFAModalsProps) {
    super(props)
    this.state = {
      isLoading: true,
      qrCode: this.props.qrCode || null,
      currentStep: this.getInitalModalStep(),
      // Currently input code, used for confirm
      inputString: '',
      backupCodes: null,
      downloadClicked: false,
      errorText: undefined,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.setState({
      isLoading: false,
    })

    this.unlisteners.push(
      mfaActions.activate.completed.listen(this.mfaActivated.bind(this)),
      mfaActions.confirm.completed.listen(this.mfaBackupCodes.bind(this)),
      mfaActions.regenerate.completed.listen(this.mfaBackupCodes.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this)),

      mfaActions.confirm.failed.listen(this.updateErrorText.bind(this)),
      mfaActions.regenerate.failed.listen(this.updateErrorText.bind(this)),
      mfaActions.deactivate.failed.listen(this.updateErrorText.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  mfaActivated(response: mfaActivatedResponse) {
    this.setState({
      qrCode: response.details,
      currentStep: 'qr',
    })
  }

  mfaConfirm() {
    mfaActions.confirm(this.state.inputString)
  }

  mfaBackupCodes(response: mfaBackupCodesResponse) {
    this.setState({
      backupCodes: response.backup_codes,
      currentStep: 'backups',
    })
  }

  mfaDeactivate() {
    mfaActions.deactivate(this.state.inputString)
  }

  mfaDeactivated() {
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
  updateErrorText() {
    this.setState({errorText: t('Incorrect token')})
  }

  getSecretKey(): string {
    // We expect backend to not change the way the secret key is returned
    return (
      this.props?.qrCode?.split('=')[1].split('&')[0] ||
      t('Could not generate secret key')
    )
  }

  getInitalModalStep(): modalSteps {
    switch(this.props.modalType) {
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

    switch(this.props.modalType) {
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
    nextStep: modalSteps
  ) {
    evt.preventDefault()

    this.setState({currentStep: nextStep})
  }

  isTokenValid(): boolean {
    return this.state.inputString !== null && this.state.inputString.length === 6
  }

  downloadCodes() {
    if (this.state.backupCodes) {
      const USERNAME = stores.session.currentAccount.username
      // gets date in yyyymmdd
      const DATE = new Date().toJSON().slice(0,10).replace(/-/g,'')

      const formatedCodes = this.state.backupCodes.map((t)  => {
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
      <bem.MFAModals__qrstep>
        <bem.MFAModals__description>
          {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We reccomend enabling Two-factor Authenication for an additional layer of protection.')}
        </bem.MFAModals__description>

        <bem.MFAModals__body>
          <bem.MFAModals__qr>
            <QRCode
              value={this.state.qrCode || ''}
              size={240}
            />
          </bem.MFAModals__qr>

          <bem.MFAModals__token>
            <strong>
              {t('Scan QR code and enter the six-digit token from the application')}
            </strong>

            {t('After scanning the QR code image, the app will display a six-digit code that you can display below.')}

            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
            />
            <bem.MFAModals__manual>
              {t('No QR code?')}

              &nbsp;

              <bem.MFAModals__manual__link
                onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                  this.changeStep(evt, 'manual')
                }}
              >
                {t('Enter key manually')}
              </bem.MFAModals__manual__link>
            </bem.MFAModals__manual>
          </bem.MFAModals__token>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Next')}
              onClick={this.mfaConfirm.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModals__footer__right>
        </bem.MFAModals__footer>
      </bem.MFAModals__qrstep>
    )
  }

  renderBackupStep() {
    this.disableCloseIcon()

    return(
      <bem.MFAModals__backupstep>
        <bem.MFAModals__description>
          {t('The following recovery codes will help you access your account in case your authenticator fails. These codes are unique and fill not be stored in your KoBo account. Please download the file and keep it somewhere safe.')}
        </bem.MFAModals__description>

        <bem.MFAModals__body>
          {this.state.backupCodes &&
            <bem.MFAModals__codes>
              <bem.MFAModals__list>
                {this.state.backupCodes.map((t) => {
                  return (
                    <bem.MFAModals__list__item>
                      <strong>
                        {t}
                      </strong>
                    </bem.MFAModals__list__item>
                  )
                })}
              </bem.MFAModals__list>
            </bem.MFAModals__codes>
          }
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footer__left>
            <Button
              type='frame'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Download codes')}
              onClick={this.downloadCodes.bind(this)}
            />
          </bem.MFAModals__footer__left>

          <bem.MFAModals__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('I have saved my recovery codes')}
              onClick={this.closeModal.bind(this)}
              isDisabled={!this.state.downloadClicked}
            />
          </bem.MFAModals__footer__right>
        </bem.MFAModals__footer>
      </bem.MFAModals__backupstep>
    )
  }

  renderManualStep() {
    return(
      <bem.MFAModals__manualstep>
        <bem.MFAModals__description>
          {t('Enter the following key into your authentication app to generate the six digit token')}
        </bem.MFAModals__description>

        <bem.MFAModals__body>
          <bem.MFAModals__codes>
            {this.getSecretKey()}
          </bem.MFAModals__codes>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Continue')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'qr')
              }}
            />
          </bem.MFAModals__footer__right>
        </bem.MFAModals__footer>
      </bem.MFAModals__manualstep>
    )
  }

  renderTokenStep() {
    return (
      <bem.MFAModals__tokenstep>
        <bem.MFAModals__body>
          <bem.MFAModals__token>
            <strong>
              {/*This is safe as this step only shows if not on qr step*/}
              {t(
                'Please enter your six-digit authenticator token to ##ACTION##'
              ).replace(
                '##ACTION##',
                this.props.modalType === 'regenerate'
                  ? t('regenerate your backup codes.')
                  : t('deactivate two-factor authentication.')
              )}
            </strong>

            <TextBox
              errors={this.state.errorText}
              value={this.state.inputString}
              onChange={this.onInputChange.bind(this)}
              customModifiers={'on-white'}
            />
          </bem.MFAModals__token>
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Next')}
              onClick={
                this.handleTokenSubmit.bind(this)
              }
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFAModals__footer__right>
        </bem.MFAModals__footer>
      </bem.MFAModals__tokenstep>
    )
  }

  renderDisclaimerStep() {
    return (
      <bem.MFAModals__disclaimerstep
        m={this.props.modalType === 'regenerate' ? 'regenerate' : ''}
      >
        <bem.MFAModals__body>
          <strong>
            {/*This is safe as this step only shows if on reconfigure or regenerate*/}
            {t(
              'Please note that ##ACTION##'
            ).replace(
              '##ACTION##',
              this.props.modalType === 'regenerate'
                ? t('recovery codes from the previous set up will not be valid anymore')
                : t('in order to reconfigure two-factor authentication (2FA), the previous set up will need to be deleted. Tokens or recovery codes from the previous set up will not be valid anymore')
            )}
          </strong>

          {this.props.modalType === 'reconfigure' &&
            <p>
              {t('Once your 2FA has been deactivated, you\'ll be prompted to configure it again. If you cannot complete the process. two-factor authentication will remain disabled for your account. In this case, you can reenable it at any time through the usual process.')}
            </p>
          }
        </bem.MFAModals__body>

        <bem.MFAModals__footer>
          <bem.MFAModals__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Next')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'token')
              }}
            />
          </bem.MFAModals__footer__right>
        </bem.MFAModals__footer>
      </bem.MFAModals__disclaimerstep>
    )
  }

 /**
  * TODO:
  * $ Remove old modal styling (headers, padding etc)
  * $ Add transition to showing backup codes
  * $ add transition to manually entering key
  * $ use custom button merged into beta
  * - make a confirm step that asks user if they are sure they want to reconfigure
  * - make css
  */
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
      </bem.MFAModals>
    )
  }
}
