import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import classNames from 'classnames';

import TextBox from 'js/components/textBox';

import bem from 'js/bem';
import stores from 'js/stores';
import mixins from 'js/mixins';
import ui from 'js/ui';
import actions from 'js/actions';
import {MODAL_TYPES} from 'js/constants'

import {t, getLangAsObject, getLangString, notify} from 'utils';

export class TranslationSettings extends React.Component {
  constructor(props){
    super(props);

    let translations = [];
    if (props.asset) {
      translations = props.asset.content.translations;
    }

    this.state = {
      assetUid: props.assetUid,
      asset: props.asset,
      translations: translations,
      showAddLanguageForm: false,
      renameLanguageIndex: -1
    }
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(stores.asset, this.onAssetsChange);

    if (!this.state.asset && this.state.assetUid) {
      stores.allAssets.whenLoaded(this.props.assetUid, this.onAssetChange);
    }
  }
  onAssetChange(asset) {
    this.setState({
      asset: asset,
      translations: asset.content.translations || [],
      showAddLanguageForm: false,
      renameLanguageIndex: -1
    })

    stores.pageState.showModal({
      type: MODAL_TYPES.FORM_LANGUAGES,
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
  launchTranslationTableModal(evt) {
    const index = evt.currentTarget.dataset.index;
    stores.pageState.switchModal({
      type: MODAL_TYPES.FORM_TRANSLATIONS_TABLE,
      asset: this.state.asset,
      langIndex: index
    });
  }
  onLanguageChange(lang, index) {
    let content = this.state.asset.content;
    if (index > -1) {
      content.translations[index] = getLangString(lang);
    } else {
      content.translations.push(getLangString(lang));
      content = this.prepareTranslations(content);
    }

    this.updateAsset(content);
  }
  canAddLanguages() {
    return !(this.state.translations.length === 1 && this.state.translations[0] === null);
  }
  getAllLanguages(thisLanguage) {
    return this.state.translations;
  }
  deleteLanguage(evt) {
    const index = evt.currentTarget.dataset.index;
    const content = this.deleteTranslations(this.state.asset.content, index);
    if (content) {
      content.translations.splice(index, 1);
      const dialog = alertify.dialog('confirm');
      const opts = {
        title: t('Delete language?'),
        message: t('Are you sure you want to delete this language? This action is not reversible.'),
        labels: {ok: t('Delete'), cancel: t('Cancel')},
        onok: () => {
          this.updateAsset(content);
          dialog.destroy();
        },
        oncancel: () => {dialog.destroy()}
      };
      dialog.set(opts).show();
    } else {
      notify('Error: translation index mismatch. Cannot delete language.');
    }
  }
  prepareTranslations(content) {
    let translated = content.translated,
        translationsLength = content.translations.length,
        survey = content.survey,
        choices = content.choices;

    // append null values to translations for each survey row
    for (var i = 0, len = survey.length; i < len; i++) {
      let row = survey[i];
      for (var j = 0, len2 = translated.length; j < len2; j++) {
        var property = translated[j];
        if (row[property] && row[property].length < translationsLength) {
          row[property].push(null);
        }
      }
    }

    // append null values to translations for choices
    if (content.choices && content.choices.length) {
      for (var i = 0, len = choices.length; i < len; i++) {
        if (choices[i].label.length < translationsLength) {
          choices[i].label.push(null);
        }
      }
    }
    return content;
  }
  deleteTranslations(content, langIndex) {
    let translated = content.translated,
        translationsLength = content.translations.length,
        survey = content.survey,
        choices = content.choices;

    for (var i = 0, len = survey.length; i < len; i++) {
      let row = survey[i];
      for (var j = 0, len2 = translated.length; j < len2; j++) {
        var property = translated[j];
        if (row[property]) {
          if (row[property].length === translationsLength) {
            row[property].splice(langIndex, 1);
          } else {
            console.error('Translations index mismatch');
            return false;
          }
        }
      }
    }

    if (content.choices && content.choices.length) {
      for (var i = 0, len = choices.length; i < len; i++) {
        if (choices[i].label) {
          if (choices[i].label.length === translationsLength) {
            choices[i].label.splice(langIndex, 1);
          } else {
            console.error('Translations index mismatch');
            return false;
          }
        }
      }
    }
    return content;
  }
  updateAsset (content) {
    actions.resources.updateAsset(
      this.state.asset.uid,
      {content: JSON.stringify(content)}
    );
  }
  renderEmptyMessage() {
    return (
      <bem.FormModal m='translation-settings'>
        <bem.FormModal__item>
          <bem.FormView__cell>
            {t('There is nothing to translate in this form.')}
          </bem.FormView__cell>
        </bem.FormModal__item>
      </bem.FormModal>
    );
  }
  renderLoadingMessage() {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {t('loading...')}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
  renderTranslationsSettings(translations) {
    return (
      <bem.FormModal m='translation-settings'>
        <bem.FormModal__item>
          {(translations && translations[0] === null) ?
            <bem.FormView__cell m='translation-note'>
              {t('Here you can add more languages to your project, and translate the strings in each of them.')}
              &nbsp;
              <em>
                {t('Note: make sure to configure your default language before adding more.')}
              </em>
            </bem.FormView__cell>
            :
            <bem.FormView__cell m='label'>
              {t('Current languages')}
            </bem.FormView__cell>
          }
          {translations.map((l, i)=> {
            return (
              <React.Fragment key={`lang-${i}`}>
                <bem.FormView__cell m='translation'>
                  <bem.FormView__cell>
                    {l ? l : t('Unnamed language')}
                    <em>{i === 0 ? ` ${t('default')}` : ''}</em>
                  </bem.FormView__cell>
                  <bem.FormView__cell m='translation-actions'>
                    <bem.FormView__link
                      m='rename'
                      onClick={this.toggleRenameLanguageForm}
                      data-index={i}
                      data-tip={t('Edit language')}
                    >
                      <i className='k-icon-edit' />
                    </bem.FormView__link>

                    {i > 0 &&
                      <bem.FormView__link
                        m='translate'
                        data-index={i}
                        onClick={this.launchTranslationTableModal}
                        data-tip={t('Update translations')}
                      >
                        <i className='k-icon-globe' />
                      </bem.FormView__link>
                    }

                    {i > 0 &&
                      <bem.FormView__link
                        m='translate'
                        onClick={this.deleteLanguage}
                        data-index={i}
                        data-tip={t('Delete language')}
                      >
                        <i className='k-icon-trash' />
                      </bem.FormView__link>
                    }
                  </bem.FormView__cell>
                </bem.FormView__cell>
                {this.state.renameLanguageIndex === i &&
                  <bem.FormView__cell m='update-language-form'>
                    <LanguageForm
                      langString={l}
                      langIndex={i}
                      onLanguageChange={this.onLanguageChange}
                      existingLanguages={this.getAllLanguages(l)}
                    />
                  </bem.FormView__cell>
                }
              </React.Fragment>
            );
          })}
          {!this.state.showAddLanguageForm &&
            <bem.FormView__cell m='add-language'>
              <button
                className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
                onClick={this.showAddLanguageForm}
                disabled={!this.canAddLanguages()}
              >
                {t('Add language')}
              </button>
            </bem.FormView__cell>
          }
          {this.state.showAddLanguageForm &&
            <bem.FormView__cell m='add-language-form'>
              <bem.FormView__link m='close' onClick={this.hideAddLanguageForm}>
                <i className='k-icon-close' />
              </bem.FormView__link>
              <bem.FormView__cell m='label'>
                {t('Add a new language')}
              </bem.FormView__cell>
              <LanguageForm
                onLanguageChange={this.onLanguageChange}
                existingLanguages={this.getAllLanguages()}
              />
            </bem.FormView__cell>
          }
        </bem.FormModal__item>
      </bem.FormModal>
    );
  }
  render () {
    if (!this.state.asset) {
      return this.renderLoadingMessage();
    }

    let translations = this.state.translations;
    if (translations.length === 0) {
      return this.renderEmptyMessage();
    } else {
      return this.renderTranslationsSettings(translations);
    }
  }
};

reactMixin(TranslationSettings.prototype, Reflux.ListenerMixin);

export default TranslationSettings;

/*
Properties:
- langString <string>: follows pattern "NAME (CODE)"
- langIndex <string>
- onLanguageChange <function>: required
- existingLanguages <langString[]>: for validation purposes
*/
class LanguageForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      nameError: null,
      code: '',
      codeError: null
    }

    if (this.props.langString) {
      const lang = getLangAsObject(this.props.langString);
      this.state = {
        name: lang.name || '',
        code: lang.code || ''
      }
    }
    autoBind(this);
  }
  isLanguageNameValid() {
    if (this.props.existingLanguages) {
      let isNameUnique = true;
      this.props.existingLanguages.forEach((langString) => {
        if (this.props.langString && langString === this.props.langString) {
          // skip comparing to itself (editing language context)
        } else if (langString !== null) {
          const langObj = getLangAsObject(langString);
          if (langObj.name === this.state.name) {
            isNameUnique = false;
          }
        }
      });
      return isNameUnique;
    } else {
      return true;
    }
  }
  isLanguageCodeValid() {
    if (this.props.existingLanguages) {
      let isCodeUnique = true;
      this.props.existingLanguages.forEach((langString) => {
        if (this.props.langString && langString === this.props.langString) {
          // skip comparing to itself (editing language context)
        } else if (langString !== null) {
          const langObj = getLangAsObject(langString);
          if (langObj.code === this.state.code) {
            isCodeUnique = false;
          }
        }
      });
      return isCodeUnique;
    } else {
      return true;
    }
  }
  onSubmit(evt) {
    evt.preventDefault();

    const isNameValid = this.isLanguageNameValid();
    if (!isNameValid) {
      this.setState({nameError: t('Name must be unique!')});
    } else {
      this.setState({nameError: null});
    }

    const isCodeValid = this.isLanguageCodeValid();
    if (!isCodeValid) {
      this.setState({codeError: t('Code must be unique!')});
    } else {
      this.setState({codeError: null});
    }

    if (isNameValid && isCodeValid) {
      let langIndex = -1;
      if (this.props.langIndex !== undefined) {
        langIndex = this.props.langIndex;
      }
      this.props.onLanguageChange({
        name: this.state.name,
        code: this.state.code
      }, langIndex);
    }
  }
  onNameChange (newName) {
    this.setState({name: newName.trim()});
  }
  onCodeChange (newCode) {
    this.setState({code: newCode.trim()});
  }
  render () {
    let isAnyFieldEmpty = this.state.name.length === 0 || this.state.code.length === 0;

    return (
      <bem.FormView__form m='add-language-fields'>
        <bem.FormView__cell m='lang-name'>
          <bem.FormModal__item>
            <label>{t('Language name')}</label>
            <TextBox
              value={this.state.name}
              onChange={this.onNameChange}
              errors={this.state.nameError}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='lang-code'>
          <bem.FormModal__item>
            <label>{t('Language code')}</label>
            <TextBox
              value={this.state.code}
              onChange={this.onCodeChange}
              errors={this.state.codeError}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='submit-button'>
          <button
            className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
            onClick={this.onSubmit} type='submit'
            disabled={isAnyFieldEmpty}
          >
            {this.props.langIndex !== undefined ? t('Update') : t('Add')}
          </button>
        </bem.FormView__cell>
      </bem.FormView__form>
      );
  }
};
