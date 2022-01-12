import React from 'react'
import bem, {makeBem} from 'js/bem'
import QRCode from 'qrcode.react'
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

bem.MFASetup__foooter = makeBem(bem.MFASetup, 'footer', 'footer')

type modalSteps = 'qr' | 'backups' | 'manual'

type MFASetupProps = {
  qrCode: string,
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
      currentStep: 'qr',
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
    return this.props.qrCode.split('=')[1].split('&')[0]
  }

  renderQRCodeStep() {
    return (
      <bem.MFASetup__qrstep>
        <bem.MFASetup__description>
          {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We reccomend enabling Two-factor Authenication for an additional layer of protection*.')}
        </bem.MFASetup__description>

        <bem.MFASetup__body>
          <bem.MFASetup__qr>
            <QRCode value={this.props.qrCode}/>
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

        <bem.MFASetup__foooter>
          <button onClick={this.mfaConfirm.bind(this)}/>
        </bem.MFASetup__foooter>
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

        <bem.MFASetup__foooter>
          <button onClick={this.mfaConfirm.bind(this)}/>
          <button onClick={this.mfaConfirm.bind(this)}/>
        </bem.MFASetup__foooter>
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

        <bem.MFASetup__foooter>
          <button onClick={this.mfaConfirm.bind(this)}/>
          <button onClick={this.mfaConfirm.bind(this)}/>
        </bem.MFASetup__foooter>
      </bem.MFASetup__manualstep>
    )
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
      </bem.MFASetup>
    )
  }
}
