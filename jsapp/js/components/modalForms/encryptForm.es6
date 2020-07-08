import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import TextBox from 'js/components/textBox';
import {t} from 'utils';
import {actions} from 'js/actions';

class EncryptForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      submissionURL: '',
      publicKey: '',
    };

    autoBind(this);
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
              onChange={this.onSubmissionURLChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='encrypt-key'>
          <bem.FormModal__item>
            <label>{t('Public key')}</label>
            <TextBox
              onChange={this.onPublicKeyChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='submit-button'>
          <button
            className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
            onClick={this.onSubmit} type='submit'
          >
            {t('Add encryption')}
          </button>
          <button className="encrypt-help" onClick={this.openEncryptionHelp} data-tip={t('Learn more about encrypting forms')}>
            <i className='k-icon k-icon-help'/>
          </button>
        </bem.FormView__cell>
      </bem.FormView__form>
      );
  }
}

export default EncryptForm;
