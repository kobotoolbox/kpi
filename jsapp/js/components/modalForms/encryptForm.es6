import autoBind from 'react-autobind';
import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import TextBox from 'js/components/common/textBox';

import {actions} from 'js/actions';
import bem from 'js/bem';
import {MODAL_TYPES} from 'js/constants';
import {stores} from 'js/stores';

class EncryptForm extends React.Component {
  constructor(props) {
    super(props);

    let submissionURL, publicKey;
    if (props.asset) {
      submissionURL = props.asset.content.settings.submission_url;
      publicKey = props.asset.content.settings.public_key;
    }

    this.state = {
      asset: props.asset,
      assetUid: props.assetUid,
      submissionURL: submissionURL || '',
      publicKey: publicKey || '',
      clearEncryption: false,
      isPending: false
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetsChange);

    if (!this.state.asset && this.state.assetUid) {
      if (stores.asset.data[this.state.assetUid]) {
        this.onAssetChange(stores.asset.data[this.state.assetUid]);
      } else {
        stores.allAssets.whenLoaded(this.props.assetUid, this.onAssetChange);
      }
    }
  }

  onAssetChange(asset) {
    this.setState({
      asset: asset,
      isPending: false,
      submissionURL: asset.content.settings.submission_url,
      publicKey: asset.content.settings.public_key
    });

    stores.pageState.showModal({
      type: MODAL_TYPES.ENCRYPT_FORM,
      asset: asset
    });
  }

  onAssetsChange(assetsList) {
    let uid;
    if (this.state.asset) {
      uid = this.state.asset.uid;
    } else if (this.state.assetUid) {
      uid = this.state.assetUid;
    }

    if (assetsList.uid !== null) {
      this.onAssetChange(assetsList[uid]);
    }
  }

  updateAsset(content) {
    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)}
    );
  }
  onSubmit(evt) {
    evt.preventDefault();

    this.setState({isPending: true})
    var content = this.state.asset.content;
    content.settings.submission_url = this.state.submissionURL;
    content.settings.public_key = this.state.publicKey;
    this.updateAsset(content);
  }
  onRemove(evt) {
    evt.preventDefault();
    this.setState({clearEncryption: true});

    this.setState({isPending: true})
    var content = this.state.asset.content
    content.settings.submission_url = '';
    content.settings.public_key = '';
    this.updateAsset(content);
  }

  onSubmissionURLChange (newSubmissionURL) {
    this.setState({
      submissionURL: newSubmissionURL,
      clearEncryption: false
    });
  }
  onPublicKeyChange (newPublicKey) {
    this.setState({
      publicKey: newPublicKey,
      clearEncryption: false
    });
  }

  openEncryptionHelp() {
    window.open('https://support.kobotoolbox.org/encrypting_forms.html', '_blank');
  }

  render () {
    return (
      <bem.FormView__form m='add-language-fields'>
        <bem.FormView__cell m='encrypt-url'>
          <bem.FormModal__item>
            <label>{t('Submission URL')}</label>
            <TextBox
              value={!this.state.clearEncryption ? this.state.submissionURL : ''}
              onChange={this.onSubmissionURLChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='encrypt-key'>
          <bem.FormModal__item>
            <label>{t('Public key')}</label>
            <TextBox
              value={!this.state.clearEncryption ? this.state.publicKey : ''}
              onChange={this.onPublicKeyChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='submit-button'>
          <button
            className='mdl-button mdl-button--raised mdl-button--colored'
            disabled={this.state.isPending}
            onClick={this.onSubmit} type='submit'
          >
            {t('Set encryption')}
          </button>
          <button
            className='remove-encryption mdl-button mdl-button--colored mdl-button--red mdl-button--raised'
            disabled={this.state.isPending}
            onClick={this.onRemove} type='submit'
          >
            {t('Remove encryption')}
          </button>
          <button className="encrypt-help" onClick={this.openEncryptionHelp} data-tip={t('Learn more about encrypting forms')}>
            <i className='k-icon k-icon-help'/>
          </button>
        </bem.FormView__cell>
      </bem.FormView__form>
      );
  }
}

reactMixin(EncryptForm.prototype, Reflux.ListenerMixin);

export default EncryptForm;
