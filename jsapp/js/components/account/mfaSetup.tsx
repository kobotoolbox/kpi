import React from 'react'
import bem, {makeBem} from 'js/bem'
import { stores } from 'jsapp/js/stores'
import QRCode from 'qrcode.react'
import Button from 'js/components/common/button'
import mfaActions, {
  mfaBackupCodesResponse,
} from 'js/actions/mfaActions'

bem.MFASetup = makeBem(null, 'mfa-setup')
bem.MFASetup__qrstep = makeBem(bem.MFASetup, 'qrstep')
bem.MFASetup__backupstep = makeBem(bem.MFASetup, 'backupstep')
bem.MFASetup__manualstep = makeBem(bem.MFASetup, 'manualstep')

bem.MFASetup__title = makeBem(bem.MFASetup, 'title', 'h4')
bem.MFASetup__description = makeBem(bem.MFASetup, 'description')

bem.MFASetup__body = makeBem(bem.MFASetup, 'body')
bem.MFASetup__qr = makeBem(bem.MFASetup, 'qr')
bem.MFASetup__token = makeBem(bem.MFASetup, 'token')
bem.MFASetup__token__input = makeBem(bem.MFASetup__token, 'token__input', 'input')
bem.MFASetup__manual = makeBem(bem.MFASetup, 'manual')
bem.MFASetup__manual__link = makeBem(bem.MFASetup__token, 'manual__link', 'a')
bem.MFASetup__codes = makeBem(bem.MFASetup, 'codes')
bem.MFASetup__codes__item = makeBem(bem.MFASetup__codes, 'item', 'strong')

bem.MFASetup__footer = makeBem(bem.MFASetup, 'footer', 'footer')
bem.MFASetup__footer__left = makeBem(bem.MFASetup__footer, 'footer-left')
bem.MFASetup__footer__right = makeBem(bem.MFASetup__footer, 'footer-right')

type modalSteps = 'qr' | 'backups' | 'manual' | 'token'

type MFASetupProps = {
  onModalClose: Function,
  qrCode?: string,
  modalType?: 'regenerate' | 'deactivate'
}

type MFASetupState = {
  isLoading: boolean,
  currentStep: modalSteps,
  inputString: null | string,
  backupCodes: null | string[],
}

export default class MFASetup extends React.Component<
  MFASetupProps,
  MFASetupState
> {
  constructor(props: MFASetupProps) {
    super(props)
    this.state = {
      isLoading: true,
      currentStep: this.props.qrCode ? 'qr' : 'token',
      // Currently input code, used for confirm
      inputString: null,
      backupCodes: null,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.setState({
      isLoading: false,
    })

    this.unlisteners.push(
      mfaActions.confirm.completed.listen(this.mfaBackupCodes.bind(this)),
      mfaActions.regenerate.completed.listen(this.mfaBackupCodes.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
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
    this.props.onModalClose()
  }

  mfaRegenerate() {
    mfaActions.regenerate(this.state.inputString)
  }

  onInputChange(response: React.FormEvent<HTMLInputElement>) {
    this.setState({inputString: response.currentTarget.value})
  }

  changeStep(
    evt: React.ChangeEvent<HTMLInputElement>,
    nextStep: modalSteps
  ) {
    evt.preventDefault()

    this.setState({currentStep: nextStep})
  }

  getSecretKey(): string {
    // We expect backend to not change the way the secret key is returned
    return (
      this.props?.qrCode?.split('=')[1].split('&')[0] ||
      t('Could not generate secret key')
    )
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
    }
  }

  renderQRCodeStep() {
    return (
      <bem.MFASetup__qrstep>
        <bem.MFASetup__description>
          {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We reccomend enabling Two-factor Authenication for an additional layer of protection*.')}
        </bem.MFASetup__description>

        <bem.MFASetup__body>
          <bem.MFASetup__qr>
            <QRCode value={this.props.qrCode || ''}/>
          </bem.MFASetup__qr>

          <bem.MFASetup__token>
            <strong>
              {t('Scan QR code and enter the six-digit token from the application')}
            </strong>

            {t('After scanning the QR code image, the app will display a six-digit code that you can display below.')}

            <bem.MFASetup__token__input
              type='text'
              onChange={this.onInputChange.bind(this)}
            />
            <bem.MFASetup__manual>
              {t('No QR code?')}

              &nbsp;

              <bem.MFASetup__manual__link
                onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                  this.changeStep(evt, 'manual')
                }}
              >
                {t('Enter key manually')}
              </bem.MFASetup__manual__link>
            </bem.MFASetup__manual>
          </bem.MFASetup__token>
        </bem.MFASetup__body>

        <bem.MFASetup__footer>
          <bem.MFASetup__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Next')}
              onClick={this.mfaConfirm.bind(this)}
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFASetup__footer__right>
        </bem.MFASetup__footer>
      </bem.MFASetup__qrstep>
    )
  }

  renderBackupStep() {
    return(
      <bem.MFASetup__backupstep>
        <bem.MFASetup__description>
          {t('The following recovery codes will help you access your account in case your authenticator fails. These codes are unique and fill not be stored in your KoBo account. Please download the file and keep it somewhere safe.')}
        </bem.MFASetup__description>

        <bem.MFASetup__body>
          {this.state.backupCodes &&
            <bem.MFASetup__codes>
              {this.state.backupCodes.map((t) => {
                return (
                  <bem.MFASetup__codes__item>
                    {t}
                  </bem.MFASetup__codes__item>
                )
              })}
            </bem.MFASetup__codes>
          }
        </bem.MFASetup__body>

        <bem.MFASetup__footer>
          <bem.MFASetup__footer__left>
            <Button
              type='frame'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Download codes')}
              onClick={this.downloadCodes.bind(this)}
              //onClick={this.mfaConfirm.bind(this)}
              //isDisabled={!this.isTokenValid()}
            />
          </bem.MFASetup__footer__left>

          <bem.MFASetup__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Next')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'backups')
              }}
              //onClick={this.mfaConfirm.bind(this)}
              //isDisabled={!this.isTokenValid()}
            />
          </bem.MFASetup__footer__right>
        </bem.MFASetup__footer>
      </bem.MFASetup__backupstep>
    )
  }

  renderManualStep() {
    return(
      <bem.MFASetup__manualstep>
        <bem.MFASetup__description>
          {t('Enter the following key into your authentication app to generate the six digit token')}
        </bem.MFASetup__description>

        <bem.MFASetup__body>
          <bem.MFASetup__codes>
            {this.getSecretKey()}
          </bem.MFASetup__codes>
        </bem.MFASetup__body>

        <bem.MFASetup__footer>
          <bem.MFASetup__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('OK')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.changeStep(evt, 'qr')
              }}
            />
          </bem.MFASetup__footer__right>
        </bem.MFASetup__footer>
      </bem.MFASetup__manualstep>
    )
  }

  renderTokenStep() {
    return (
      <bem.MFASetup__tokenstep>
        <bem.MFASetup__body>
          <bem.MFASetup__token>
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

            <bem.MFASetup__token__input
              type='text'
              onChange={this.onInputChange.bind(this)}
            />
          </bem.MFASetup__token>
        </bem.MFASetup__body>

        <bem.MFASetup__footer>
          <bem.MFASetup__footer__right>
            <Button
              type='full'
              color='blue'
              size='l'
              isFullWidth={true}
              label={t('Next')}
              onClick={
                (this.props.modalType === 'regenerate')
                  ? this.mfaRegenerate.bind(this)
                  : this.mfaDeactivate.bind(this)
              }
              isDisabled={!this.isTokenValid()}
            />
          </bem.MFASetup__footer__right>
        </bem.MFASetup__footer>
      </bem.MFASetup__tokenstep>
    );
  }

 /**
  * TODO:
  * $ Remove old modal styling (headers, padding etc)
  * - Add transition to showing backup codes
  * $ add transition to manually entering key
  * - use custom button merged into beta
  * - make css
  */
  render() {
    return (
      <bem.MFASetup>
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
      </bem.MFASetup>
    )
  }
}
