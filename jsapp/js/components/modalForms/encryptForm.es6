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

  render () {
    return (
      <bem.FormView__form m='add-language-fields'>
        <bem.FormView__cell m='lang-name'>
          <bem.FormModal__item>
            <label>{t('Submission URL')}</label>
            <TextBox
              onChange={this.onSubmissionURLChange}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='lang-code'>
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
        </bem.FormView__cell>
      </bem.FormView__form>
      );
  }
}

export default EncryptForm;
