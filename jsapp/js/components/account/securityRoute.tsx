import React from 'react'
import bem, {makeBem} from 'js/bem'
import Button from 'js/components/common/button'
import ToggleSwitch from 'js/components/common/toggleSwitch'
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
      mfaActions.activate.completed.listen(this.mfaActivating.bind(this)),
      mfaActions.confirm.completed.listen(this.mfaActivated.bind(this)),
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

  mfaActivating(response: mfaActivatedResponse) {
    if (response && !response.inModal) {
      stores.pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        qrCode: response.details,
        modalType: 'qr',
        customModalHeader: this.renderCustomHeader(),
      })
    }
  }

  mfaActivated() {
    this.setState({mfaActive: true})
  }

  mfaDeactivated() {
    this.setState({mfaActive: false})
  }

  onToggleChange(response: boolean) {
    if (response) {
      mfaActions.activate();
    } else {
      stores.pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        modalType: 'deactivate',
        customModalHeader: this.renderCustomHeader(),
      })
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

 /**
  * TODO:
  * - redo bem elements
  * - make css
  */
  render() {
    console.dir(this.state)
    return (
      <bem.SecurityRow>
        <label>
          Security
        </label>

        <ToggleSwitch
          checked={this.state.mfaActive}
          onChange={this.onToggleChange.bind(this)}
        />

        {this.state.mfaActive &&
          <div>
            <label>
              Authenticator app
            </label>
            <Button
              type='frame'
              color='storm'
              label='Reconfigure'
              size='l'
              onClick={() => {
                stores.pageState.showModal({
                  type: MODAL_TYPES.MFA_MODALS,
                  modalType: 'reconfigure',
                  customModalHeader: this.renderCustomHeader(),
                })
              }}
            />

            <label>
              Regenerate backups
            </label>
            <Button
              type='frame'
              color='storm'
              label='Generate new'
              size='l'
              onClick={() => {
                stores.pageState.showModal({
                  type: MODAL_TYPES.MFA_MODALS,
                  modalType: 'regenerate',
                  customModalHeader: this.renderCustomHeader(),
                })
              }}
            />
          </div>
        }
      </bem.SecurityRow>
    )
  }
}
