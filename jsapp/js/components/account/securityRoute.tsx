import React from 'react'
import bem, {makeBem} from 'js/bem'
import ToggleSwitch from 'js/components/common/toggleSwitch'
import QRCode from 'qrcode.react'
import {stores} from 'js/stores'
import mfaActions, {
  mfaActiveResponse,
  mfaActivatedResponse,
  mfaBackupCodesResponse,
} from 'js/actions/mfaActions'
import {MODAL_TYPES} from 'jsapp/js/constants'

bem.Security = makeBem(null, 'security')

bem.SecurityRow = makeBem(null, 'security-row')
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header')
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title')
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons')
bem.SecurityRow__description = makeBem(bem.SecurityRow, 'description')

bem.TableMediaPreviewHeader = makeBem(null, 'table-media-preview-header');
bem.TableMediaPreviewHeader__title = makeBem(bem.TableMediaPreviewHeader, 'title', 'div');

type SecurityState = {
  isLoading: boolean,
  mfaCode: null | string,
  qrCode: null | string,
  backupCodes: null | string[],
  mfaActive: boolean,
}

export default class Security extends React.Component<
  {},
  SecurityState
> {
  constructor(props: any) {
    super(props)
    this.state = {
      isLoading: true,
      // Currently input code, used for confirm, deactivate, regenerate
      mfaCode: null,
      qrCode: null,
      backupCodes: null,
      mfaActive: false,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.setState({
      isLoading: false,
    })

    this.unlisteners.push(
      mfaActions.isActive.completed.listen(this.mfaActive.bind(this)),
      mfaActions.activate.completed.listen(this.mfaActivated.bind(this)),
      mfaActions.regenerate.completed.listen(this.mfaBackupCodes.bind(this)),
      mfaActions.deactivate.completed.listen(this.mfaDeactivated.bind(this)),
    )

    mfaActions.isActive()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  mfaActive(response: mfaActiveResponse) {
    this.setState({mfaActive: response.length >= 1})
  }

  mfaActivated(response: mfaActivatedResponse) {
    stores.pageState.showModal({
      type: MODAL_TYPES.MFA_SETUP,
      qrCode: response.details,
      customModalHeader: this.renderCustomHeader(),
    })
  }

  mfaConfirm() {
    mfaActions.confirm(this.state.mfaCode)
  }

  mfaBackupCodes(response: mfaBackupCodesResponse) {
    this.setState({
      backupCodes: response.backup_codes,
      mfaActive: true,
    })
  }

  mfaDeactivate() {
    mfaActions.deactivate(this.state.mfaCode)
  }

  mfaDeactivated() {
    this.setState({mfaActive: false})
  }

  mfaRegenerate() {
    mfaActions.regenerate(this.state.mfaCode)
  }

  onInputChange(response: React.FormEvent<HTMLInputElement>) {
    this.setState({mfaCode: response.currentTarget.value})
  }

  onToggleChange(response: boolean) {
    if (response) {
      mfaActions.activate();
    } else {
      console.log('now we show the deactivate modal')
    }
  }

  renderCustomHeader() {
    return(
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          {t('Two-factor authentication')}
        </bem.TableMediaPreviewHeader__title>
      </bem.TableMediaPreviewHeader>
    )
  }

  render() {
    return (
      <bem.SecurityRow>
        <label>
          Security
        </label>

        <ToggleSwitch
          checked={this.state.mfaActive}
          onChange={this.onToggleChange.bind(this)}
        />

        {this.state.backupCodes &&
          <ol>
            {this.state.backupCodes.map((t) => {
              return(
                <h2>
                  {t}
                </h2>
              )
            })}
          </ol>
        }

        {this.state.mfaActive &&
          <div>
            <input type='text' onChange={this.onInputChange.bind(this)}/>
            <button onClick={this.mfaDeactivate.bind(this)}/>
            <p>reset</p>
            <input type='text' onChange={this.onInputChange.bind(this)}/>
            <button onClick={this.mfaRegenerate.bind(this)}/>
          </div>
        }
      </bem.SecurityRow>
    )
  }
}
