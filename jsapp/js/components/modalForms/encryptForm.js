import React from 'react'

import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Button from '#/components/common/button'
import TextBox from '#/components/common/textBox'
import { MODAL_TYPES } from '#/constants'
import pageState from '#/pageState.store'
import { stores } from '#/stores'

class EncryptForm extends React.Component {
  constructor(props) {
    super(props)

    let submissionURL, publicKey
    if (props.asset) {
      submissionURL = props.asset.content.settings.submission_url
      publicKey = props.asset.content.settings.public_key
    }

    this.state = {
      asset: props.asset,
      assetUid: props.assetUid,
      submissionURL: submissionURL || '',
      publicKey: publicKey || '',
      clearEncryption: false,
      isPending: false,
    }

    autoBind(this)
  }

  componentDidMount() {
    this.listenTo(assetStore, this.onAssetsChange)

    if (!this.state.asset && this.state.assetUid) {
      if (assetStore.data[this.state.assetUid]) {
        this.onAssetChange(assetStore.data[this.state.assetUid])
      } else {
        stores.allAssets.whenLoaded(this.props.assetUid, this.onAssetChange)
      }
    }
  }

  onAssetChange(asset) {
    this.setState({
      asset: asset,
      isPending: false,
      submissionURL: asset.content.settings.submission_url,
      publicKey: asset.content.settings.public_key,
    })

    pageState.showModal({
      type: MODAL_TYPES.ENCRYPT_FORM,
      asset: asset,
    })
  }

  onAssetsChange(assetsList) {
    let uid
    if (this.state.asset) {
      uid = this.state.asset.uid
    } else if (this.state.assetUid) {
      uid = this.state.assetUid
    }

    if (assetsList.uid !== null) {
      this.onAssetChange(assetsList[uid])
    }
  }

  updateAsset(content) {
    actions.resources.updateAsset(this.props.asset.uid, { content: JSON.stringify(content) })
  }
  onSubmit(evt) {
    evt.preventDefault()

    this.setState({ isPending: true })
    var content = this.state.asset.content
    content.settings.submission_url = this.state.submissionURL
    content.settings.public_key = this.state.publicKey
    this.updateAsset(content)
  }
  onRemove(evt) {
    evt.preventDefault()
    this.setState({ clearEncryption: true })

    this.setState({ isPending: true })
    var content = this.state.asset.content
    content.settings.submission_url = ''
    content.settings.public_key = ''
    this.updateAsset(content)
  }

  onSubmissionURLChange(newSubmissionURL) {
    this.setState({
      submissionURL: newSubmissionURL,
      clearEncryption: false,
    })
  }
  onPublicKeyChange(newPublicKey) {
    this.setState({
      publicKey: newPublicKey,
      clearEncryption: false,
    })
  }

  openEncryptionHelp() {
    window.open('https://support.kobotoolbox.org/encrypting_forms.html', '_blank')
  }

  render() {
    return (
      <bem.FormView__form m='add-language-fields'>
        <bem.FormView__cell m='encrypt-url'>
          <bem.FormModal__item>
            <label>{t('Submission URL')}</label>
            <TextBox
              value={this.state.clearEncryption ? '' : this.state.submissionURL}
              onChange={this.onSubmissionURLChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='encrypt-key'>
          <bem.FormModal__item>
            <label>{t('Public key')}</label>
            <TextBox value={this.state.clearEncryption ? '' : this.state.publicKey} onChange={this.onPublicKeyChange} />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='submit-button' className='encrypt-form-footer'>
          <span className='encrypt-form-footer-left'>
            <Button
              type='primary'
              size='l'
              isDisabled={this.state.isPending}
              onClick={this.onSubmit.bind(this)}
              isSubmit
              label={t('Set encryption')}
            />

            <Button
              type='text'
              size='m'
              onClick={this.openEncryptionHelp.bind(this)}
              tooltip={t('Learn more about encrypting forms')}
              startIcon='help'
            />
          </span>

          <Button
            type='danger'
            size='l'
            isDisabled={this.state.isPending}
            onClick={this.onRemove.bind(this)}
            label={t('Remove encryption')}
          />
        </bem.FormView__cell>
      </bem.FormView__form>
    )
  }
}

reactMixin(EncryptForm.prototype, Reflux.ListenerMixin)

export default EncryptForm
