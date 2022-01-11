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

bem.MFASetup__foooter = makeBem(bem.MFASetup, 'footer', 'footer')

enum MODAL_STEPS {
  'QR' = 'qr',
  'BACKUPS' = 'backups',
  'MANUAL' = 'manual',

}

type modalSteps = MODAL_STEPS.QR | MODAL_STEPS.BACKUPS | MODAL_STEPS.MANUAL

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
      currentStep: MODAL_STEPS.QR,
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
            <bem.MFASetup__token__input
              type='text'
              onChange={this.onInputChange.bind(this)}
            />
            <bem.MFASetup__manual>
              <bem.MFASetup__manual__link
                onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                  this.changeStep(evt, MODAL_STEPS.MANUAL)
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
          {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We reccomend enabling Two-factor Authenication for an additional layer of protection*.')}
        </bem.MFASetup__description>

        <bem.MFASetup__body>
          <bem.MFASetup__codes>
          </bem.MFASetup__codes>

          <bem.MFASetup__token>
            <input type='text' onChange={this.onInputChange.bind(this)}/>
          </bem.MFASetup__token>
        </bem.MFASetup__body>

        <bem.MFASetup__foooter>
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
          </bem.MFASetup__codes>

        </bem.MFASetup__body>

        <bem.MFASetup__foooter>
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
        {(this.state.currentStep === MODAL_STEPS.QR) &&
            this.renderQRCodeStep()
        }

        {(this.state.currentStep === MODAL_STEPS.BACKUPS) &&
          this.renderBackupStep()
        }

        {(this.state.currentStep === MODAL_STEPS.MANUAL) &&
          this.renderManualStep()
        }
      </bem.MFASetup>
    )
  }
}
