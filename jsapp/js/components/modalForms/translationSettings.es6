import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import classNames from 'classnames';

import bem from 'js/bem';
import stores from 'js/stores';
import mixins from 'js/mixins';
import ui from 'js/ui';
import actions from 'js/actions';
import {dataInterface} from 'js/dataInterface';
import {t,getLangAsObject, getLangString} from 'utils';

class LanguageForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      languageName: '',
      languageCode: ''
    }

    if (this.props.langString) {
      const lang = getLangAsObject(this.props.langString);
      this.state = {
        languageName: lang.name || '',
        languageCode: lang.code || ''
      }
    }
    autoBind(this);
  }
  submit() {
    if (this.props.langString) {
      this.props.addOrUpdateLanguage(this.state, this.props.langIndex);
    } else {
      this.props.addOrUpdateLanguage(this.state, -1);
    }
  }
  nameChange (e) {
    this.setState({languageName: e.target.value});
  }
  codeChange (e) {
    this.setState({languageCode: e.target.value});
  }
  render () {
    let fieldsNotEmpty = this.state.languageName.length > 0 && this.state.languageCode.length > 0;
    var btnClasses = classNames('mdl-button','mdl-js-button', 'mdl-button--raised', fieldsNotEmpty ? 'mdl-button--colored' : 'mdl-button--disabled');

    return (
      <bem.FormView__cell m='add-language-fields'>
        <bem.FormView__cell>
          <bem.FormModal__item>
            <label>{t('Language name')}</label>
            <input type="text" value={this.state.languageName} onChange={this.nameChange} />
          </bem.FormModal__item>
        </bem.FormView__cell>
        <bem.FormView__cell m='lang-code'>
          <bem.FormModal__item>
            <label>{t('Language code')}</label>
            <input type="text" value={this.state.languageCode} onChange={this.codeChange} />
          </bem.FormModal__item>
        </bem.FormView__cell>
        <bem.FormView__cell>
          <button className={btnClasses} onClick={this.submit}>
            {this.props.langString ? t('Update') : t('Add')}
          </button>
        </bem.FormView__cell>
      </bem.FormView__cell>
      );
  }
};

export class TranslationSettings extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      translations: props.asset.content.translations,
      showTranslations: false,
      showAddLanguageForm: false,
      renameLanguageIndex: -1
    }
    autoBind(this);
  }
  showAddLanguageForm() {
    this.setState({
      showAddLanguageForm: true
    })
  }
  hideAddLanguageForm() {
    this.setState({
      showAddLanguageForm: false
    })
  }
  toggleRenameLanguageForm(e) {
    let index = parseInt($(e.target).closest('[data-index]').get(0).getAttribute('data-index'));
    if (this.state.renameLanguageIndex === index) {
      this.setState({
        renameLanguageIndex: -1
      });
    } else {
      this.setState({
        renameLanguageIndex: index
      });
    }
  }
  addOrUpdateLanguage(lang, index) {
    let content = this.props.asset.content;
    if (index > -1) {
      content.translations[index] = getLangString(lang);
    } else {
      content.translations.push(getLangString(lang));
      console.error('this is not ready yet');
      // TODO: show update translation arrays with this new language
      // return false;
    }

    this.updateAsset(content);
  }
  updateAsset (content) {
    console.log(this.props.asset.uid);
    console.log(content.translations);
    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)}
    );
  }
  render () {
    return (
      <bem.FormModal m='translation-settings'>
          {!this.state.showTranslations &&
            <bem.FormModal__item>
              <bem.FormView__cell m='label'>
                {t('Current languages')}
              </bem.FormView__cell>
              {this.state.translations.map((l, i)=> {
                return (
                  <React.Fragment key={`lang-${i}`}>
                    <bem.FormView__cell m='translation'>
                      <bem.FormView__cell>
                        {l}
                      </bem.FormView__cell>
                      <bem.FormView__cell m='translation-actions'>
                        <bem.FormView__link m='rename'
                                            onClick={this.toggleRenameLanguageForm}
                                            data-index={i}
                                            data-tip={t('Edit language')}>
                          <i className="k-icon-edit" />
                        </bem.FormView__link>
                        <bem.FormView__link m='translate'
                                            data-index={i}
                                            data-tip={t('Update translations')}>
                          <i className="k-icon-globe" />
                        </bem.FormView__link>
                        <bem.FormView__link m='translate'
                                            data-index={i}
                                            data-tip={t('Delete language')}>
                          <i className='k-icon-trash' />
                        </bem.FormView__link>
                      </bem.FormView__cell>
                    </bem.FormView__cell>
                    {this.state.renameLanguageIndex === i &&
                      <bem.FormView__cell m='update-language-form'>
                        <LanguageForm langString={l} langIndex={i} addOrUpdateLanguage={this.addOrUpdateLanguage}/>
                      </bem.FormView__cell>
                    }
                  </React.Fragment>
                );
              })}
              {!this.state.showAddLanguageForm &&
                <bem.FormView__cell m='add-language'>
                  <button className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
                          onClick={this.showAddLanguageForm}>
                    {t('Add language')}
                  </button>
                </bem.FormView__cell>
              }
              {this.state.showAddLanguageForm &&
                <bem.FormView__cell m='add-language-form'>
                  <bem.FormView__link m='close' onClick={this.hideAddLanguageForm}>
                    <i className="k-icon-close" />
                  </bem.FormView__link>
                  <bem.FormView__cell m='label'>
                    {t('Add a new language')}
                  </bem.FormView__cell>
                  <LanguageForm addOrUpdateLanguage={this.addOrUpdateLanguage}/>
                </bem.FormView__cell>
              }
            </bem.FormModal__item>
          }
          {this.state.showTranslations &&
            <div>
              {t('asdasd 123 - translations for ?')}
            </div>
          }
      </bem.FormModal>
    );
  }
};

reactMixin(TranslationSettings.prototype, Reflux.ListenerMixin);

export default TranslationSettings;
