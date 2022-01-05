import React from 'react'
import bem, {makeBem} from 'js/bem'
import QRCode from 'qrcode.react'
import mfaActions, {
  mfaBackupCodesResponse,
} from 'js/actions/mfaActions'

bem.MFASetup = makeBem(null, 'mfa-setup')

bem.MFASetup__header = makeBem(bem.MFASetup, 'header', 'header')
bem.MFASetup__title = makeBem(bem.MFASetup, 'title', 'h4')
bem.MFASetup__description = makeBem(bem.MFASetup, 'description')

bem.MFASetup__body = makeBem(bem.MFASetup, 'body')
bem.MFASetup__qr = makeBem(bem.MFASetup, 'qr')
bem.MFASetup__token = makeBem(bem.MFASetup, 'token')

bem.MFASetup__foooter = makeBem(bem.MFASetup, 'footer', 'footer')

type MFASetupProps = {
  qrCode: string,
}

type MFASetupState = {
  isLoading: boolean,
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

 /**
  * TODO:
  * - Remove old modal styling (headers, padding etc)
  * - Add transition to showing backup codes
  * - add transition to manually entering key
  * - use custom button merged into beta
  * - make css
  */
  render() {
    return (
      <bem.MFASetup>
        <bem.MFASetup__header>
          <bem.MFASetup__title>
            {t('Two-factor Authentication')}
          </bem.MFASetup__title>

          <bem.MFASetup__description>
            {t('Two-factor Authenication (2FA) is an added layer of security used when logging into the platform. We reccomend enabling Two-factor Authenication for an additional layer of protection*.')}
          </bem.MFASetup__description>
        </bem.MFASetup__header>

        <bem.MFASetup__body>
          <bem.MFASetup__qr>
            <QRCode value={this.props.qrCode}/>
          </bem.MFASetup__qr>

          <bem.MFASetup__token>
            <input type='text' onChange={this.onInputChange.bind(this)}/>
            <button onClick={this.mfaConfirm.bind(this)}/>
          </bem.MFASetup__token>
        </bem.MFASetup__body>

        <bem.MFASetup__foooter>
          <button/>
        </bem.MFASetup__foooter>
      </bem.MFASetup>
    )
  }
}
