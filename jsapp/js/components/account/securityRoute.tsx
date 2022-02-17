import React from 'react'
import bem, {makeBem} from 'js/bem'
import Button from 'js/components/common/button'
import ToggleSwitch from 'js/components/common/toggleSwitch'
import Icon from 'js/components/common/icon'
import {stores} from 'js/stores'
import mfaActions, {
  MfaActiveResponse,
  MfaActivatedResponse,
} from 'js/actions/mfaActions'
import {MODAL_TYPES} from 'jsapp/js/constants'

import './securityRoute.scss'

bem.Security = makeBem(null, 'security')

bem.SecurityRow = makeBem(null, 'security-row')
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header')
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title', 'h2')
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons')
bem.SecurityRow__description = makeBem(bem.SecurityRow, 'description')

bem.MFAOptions = makeBem(null, 'mfa-options')
bem.MFAOptions__row = makeBem(bem.MFAOptions, 'row')
bem.MFAOptions__label = makeBem(bem.MFAOptions, 'label')
bem.MFAOptions__buttons = makeBem(bem.MFAOptions, 'row')

bem.TableMediaPreviewHeader = makeBem(null, 'table-media-preview-header');
bem.TableMediaPreviewHeader__title = makeBem(bem.TableMediaPreviewHeader, 'title', 'div');

type SecurityState = {
  mfaActive: boolean,
}

type EditModalTypes = 'regenerate' | 'reconfigure'

export default class Security extends React.Component<
  {},
  SecurityState
> {
  constructor(props: any) {
    super(props)
    this.state = {
      mfaActive: false,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
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

  mfaActive(response: MfaActiveResponse) {
    this.setState({mfaActive: response.length >= 1})
  }

  mfaActivating(response: MfaActivatedResponse) {
    if (response && !response.inModal) {
      stores.pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        qrCode: response.details,
        modalType: 'qr',
        customModalHeader: this.renderCustomHeader(),
        disableBackdrop: true,
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
        disableBackdrop: true,
      })
    }
  }

  showEditModal(
    evt: React.ChangeEvent<HTMLInputElement>,
    type: EditModalTypes
  ) {
    evt.preventDefault()

    stores.pageState.showModal({
        type: MODAL_TYPES.MFA_MODALS,
        modalType: type,
        customModalHeader: this.renderCustomHeader(),
        disableBackdrop: true,
    })
  }

  renderCustomHeader() {
    return (
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          <Icon
            name='lock'
            size='s'
          />
          {t('Two-factor authentication')}
        </bem.TableMediaPreviewHeader__title>
      </bem.TableMediaPreviewHeader>
    )
  }

  render() {
    return (
      <bem.SecurityRow>
        <bem.SecurityRow__header>
          <bem.SecurityRow__title>
            {t('Two-factor authentication')}
          </bem.SecurityRow__title>

          <bem.SecurityRow__buttons>
            <ToggleSwitch
              label={this.state.mfaActive ? 'Enabled' : 'Disabled'}
              checked={this.state.mfaActive}
              onChange={this.onToggleChange.bind(this)}
            />
          </bem.SecurityRow__buttons>
        </bem.SecurityRow__header>

        <bem.SecurityRow__description>
          {t('Two-factor authentication (2FA) is an added layer of security used when logging into the platform. We recommend enabling Two-factor authentication for an additonal layer of protection.')}
        </bem.SecurityRow__description>

        {this.state.mfaActive &&
          <bem.MFAOptions>
            <bem.MFAOptions__row>
              <bem.MFAOptions__label>
                {t('Authenticator app')}
              </bem.MFAOptions__label>

              <bem.MFAOptions__buttons>
                {/*Put date last configured here*/}
                <Button
                  type='frame'
                  color='storm'
                  label='Reconfigure'
                  size='l'
                  onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                    this.showEditModal(evt, 'reconfigure')
                  }}
                />
              </bem.MFAOptions__buttons>
            </bem.MFAOptions__row>

            <bem.MFAOptions__row>
              <bem.MFAOptions__label>
                {t('Recovery codes')}
              </bem.MFAOptions__label>

              <bem.MFAOptions__buttons>
                <Button
                  type='frame'
                  color='storm'
                  label='Generate new'
                  size='l'
                  onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                    this.showEditModal(evt, 'regenerate')
                  }}
                />
              </bem.MFAOptions__buttons>
            </bem.MFAOptions__row>
          </bem.MFAOptions>
        }
      </bem.SecurityRow>
    )
  }
}
