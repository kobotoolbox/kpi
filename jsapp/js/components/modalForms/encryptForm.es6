import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import TextBox from 'js/components/textBox';
import {t} from 'utils';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import {MODAL_TYPES} from 'js/constants';

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
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetsChange);

    if (!this.state.asset && this.state.assetUid) {
      if (stores.asset.data[this.state.assetUid]) {
        this.onAssetChange(stores.asset.data[this.state.assetUid]);
      } else {
        console.log(stores.allAssets);
        stores.allAssets.whenLoaded(this.props.assetUid, this.onAssetChange);
      }
    }
  }

  onAssetChange(asset) {
    console.log(asset);
    this.setState({
      asset: asset,
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
    this.onAssetChange(assetsList[uid]);
  }

  onSubmit(evt) {
    evt.preventDefault();
    var content = this.props.asset.content;
    content.settings.submission_url = this.state.submissionURL;
    content.settings.public_key = this.state.publicKey;

    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)}
    );
  }
  onSubmissionURLChange (newSubmissionURL) {
    this.setState({submissionURL: newSubmissionURL});
  }
  onPublicKeyChange (newPublicKey) {
    this.setState({publicKey: newPublicKey});
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
              value={this.state.submissionURL}
              onChange={this.onSubmissionURLChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='encrypt-key'>
          <bem.FormModal__item>
            <label>{t('Public key')}</label>
            <TextBox
              value={this.state.publicKey}
              onChange={this.onPublicKeyChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='submit-button'>
          <button
            className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
            onClick={this.onSubmit} type='submit'
          >
            {t('Set encryption')}
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
