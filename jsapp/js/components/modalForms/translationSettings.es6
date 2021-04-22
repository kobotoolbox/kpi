import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import LanguageForm from 'js/components/modalForms/languageForm';
import {bem} from 'js/bem';
import {LoadingSpinner} from 'js/ui';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {MODAL_TYPES} from 'js/constants';
import {getLangString, notify} from 'utils';
import {LOCKING_RESTRICTIONS} from 'js/components/locking/lockingConstants';
import {hasAssetRestriction} from 'js/components/locking/lockingUtils';

const LANGUAGE_SUPPORT_URL = 'language_dashboard.html';

export class TranslationSettings extends React.Component {
  constructor(props){
    super(props);

    let translations = null;
    if (props.asset && props.asset.content) {
      translations = props.asset.content.translations;
    }

    this.state = {
      assetUid: props.assetUid,
      asset: props.asset,
      translations: translations,
      showAddLanguageForm: false,
      isUpdatingDefaultLanguage: false,
      renameLanguageIndex: -1
    };
    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetsChange);

    if (this.state.asset && !this.state.asset.content) {
      stores.allAssets.whenLoaded(this.props.assetUid, this.onAssetChange);
      actions.resources.loadAsset({id: this.state.asset.uid});
    }

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
      translations: asset.content.translations || [],
      showAddLanguageForm: false,
      isUpdatingDefaultLanguage: false,
      renameLanguageIndex: -1
    });

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
    });
  }
  hideAddLanguageForm() {
    this.setState({
      showAddLanguageForm: false
    });
  }
  toggleRenameLanguageForm(evt) {
    const index = parseInt(evt.currentTarget.dataset.index);
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
    const langString = evt.currentTarget.dataset.string;
    stores.pageState.switchModal({
      type: MODAL_TYPES.FORM_TRANSLATIONS_TABLE,
      asset: this.state.asset,
      langString: langString,
      langIndex: index,
    });
  }
  onLanguageChange(lang, index) {
    let content = this.state.asset.content;
    const langString = getLangString(lang);

    if (index > -1) {
      content.translations[index] = langString;
    } else {
      content.translations.push(langString);
      content = this.prepareTranslations(content);
    }

    if (index === 0) {
      content.settings.default_language = langString;
    }

    this.updateAsset(content);
  }
  canAddLanguages() {
    return !(this.state.translations.length === 1 && this.state.translations[0] === null);
  }
  getAllLanguages() {
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
        oncancel: () => {dialog.destroy();}
      };
      dialog.set(opts).show();
    } else {
      notify(t('Translation index mismatch. Cannot delete language.'), 'error');
    }
  }
  prepareTranslations(content) {
    let translated = content.translated,
        translationsLength = content.translations.length,
        survey = content.survey,
        choices = content.choices;

    // append null values to translations for each survey row
    for (let i = 0, len = survey.length; i < len; i++) {
      let row = survey[i];
      for (let j = 0, len2 = translated.length; j < len2; j++) {
        var property = translated[j];
        if (row[property] && row[property].length < translationsLength) {
          row[property].push(null);
        }
      }
    }

    // append null values to translations for choices
    if (content.choices && content.choices.length) {
      for (let i = 0, len = choices.length; i < len; i++) {
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

    for (let i = 0, len = survey.length; i < len; i++) {
      let row = survey[i];
      for (let j = 0, len2 = translated.length; j < len2; j++) {
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
      for (let i = 0, len = choices.length; i < len; i++) {
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
  changeDefaultLanguage(evt) {
    const index = evt.currentTarget.dataset.index;
    const langString = this.state.translations[index];

    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Change default language?'),
      message: t('Are you sure you would like to set ##lang## as the default language for this form?').replace('##lang##', langString),
      labels: {ok: t('Confirm'), cancel: t('Cancel')},
      onok: () => {
        this.setState({isUpdatingDefaultLanguage: true});
        const content = this.state.asset.content;
        content.settings.default_language = langString;
        this.updateAsset(content);
        dialog.destroy();
      },
      oncancel: () => {dialog.destroy();}
    };
    dialog.set(opts).show();
  }
  updateAsset(content) {
    actions.resources.updateAsset(
      this.state.asset.uid,
      {content: JSON.stringify(content)},
      // reload asset on failure
      {onFailed: () => {
        actions.resources.loadAsset({id: this.state.asset.uid});
        alertify.error('failed to update translations');
      }}
    );
  }
  isManagingTranslationsLocked() {
    return (
      this.state.asset?.content &&
      hasAssetRestriction(this.state.asset.content, LOCKING_RESTRICTIONS.translations_manage.name)
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
  renderUndefinedDefaultSettings() {
    return (
      <bem.FormModal m='translation-settings'>
        <bem.FormModal__item>
          <bem.FormView__cell m='translation-note'>
            <p>{t('Here you can add more languages to your project, and translate the strings in each of them.')}</p>
            <p>{t('For the language code field, we suggest using the')}
              <a target='_blank' href='https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry'>
                {' ' + t('official language code') + ' '}
              </a>
              {t('(e.g. "English (en)" or "Rohingya (rhg)").')}

              { stores.serverEnvironment &&
                stores.serverEnvironment.state.support_url &&
                <a target='_blank' href={stores.serverEnvironment.state.support_url + LANGUAGE_SUPPORT_URL}>
                  {' ' + t('Read more.')}
                </a>
              }
            </p>
          </bem.FormView__cell>
          <bem.FormView__cell m='translation'>
            <p><strong>{t('Please name your default language before adding languages and translations.')}</strong></p>
          </bem.FormView__cell>
          <bem.FormView__cell m='update-language-form'>
            <LanguageForm
              onLanguageChange={this.onLanguageChange}
              existingLanguages={this.getAllLanguages()}
              isDefault
            />
          </bem.FormView__cell>
        </bem.FormModal__item>
      </bem.FormModal>
    );
  }
  renderTranslationsSettings(translations) {
    return (
      <bem.FormModal m='translation-settings'>
        <bem.FormModal__item>
          <bem.FormView__cell m='label'>
            {t('Current languages')}
          </bem.FormView__cell>
          {translations[0] == null &&
            <bem.FormView__cell m={['warning', 'translation-modal-warning']}>
              <i className='k-icon-alert' />
              <p>{t('You have named translations in your form but the default translation is unnamed. Please specifiy a default translation or make an existing one default.')}</p>
            </bem.FormView__cell>
          }
          {translations.map((l, i) => {
            return (
              <React.Fragment key={`lang-${i}`}>
                <bem.FormView__cell m='translation'>
                  <bem.FormView__cell m='translation-name'>
                    {l}

                    {i === 0 &&
                      <bem.FormView__label m='default-language'>
                        {t('default')}
                      </bem.FormView__label>
                    }

                    {i !== 0 &&
                      <bem.FormView__iconButton
                        data-index={i}
                        onClick={this.changeDefaultLanguage}
                        disabled={this.state.isUpdatingDefaultLanguage}
                        data-tip={t('Make default')}
                      >
                        <i className='k-icon-language-default' />
                      </bem.FormView__iconButton>
                    }
                  </bem.FormView__cell>

                  <bem.FormView__cell m='translation-actions'>
                    <bem.FormView__iconButton
                      data-index={i}
                      onClick={this.toggleRenameLanguageForm}
                      disabled={this.state.isUpdatingDefaultLanguage}
                      data-tip={t('Edit language')}
                      className='right-tooltip'
                    >
                      {this.state.renameLanguageIndex === i &&
                        <i className='k-icon-close' />
                      }
                      {this.state.renameLanguageIndex !== i &&
                        <i className='k-icon-edit' />
                      }
                    </bem.FormView__iconButton>

                    <bem.FormView__iconButton
                      data-index={i}
                      data-string={this.state.translations[i]}
                      onClick={this.launchTranslationTableModal}
                      disabled={this.state.isUpdatingDefaultLanguage}
                      data-tip={t('Update translations')}
                      className='right-tooltip'
                    >
                      <i className='k-icon-language-settings' />
                    </bem.FormView__iconButton>

                    {i !== 0 &&
                      <bem.FormView__iconButton
                        data-index={i}
                        onClick={this.deleteLanguage}
                        disabled={this.state.isUpdatingDefaultLanguage}
                        data-tip={t('Delete language')}
                        className='right-tooltip'
                      >
                        <i className='k-icon-trash' />
                      </bem.FormView__iconButton>
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
              <bem.KoboButton
                m='blue'
                onClick={this.showAddLanguageForm}
                disabled={!this.canAddLanguages()}
              >
                {t('Add language')}
              </bem.KoboButton>
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
  render() {
    if (
      !this.state.asset ||
      !this.state.asset.content ||
      this.state.translations === null
    ) {
      return (<LoadingSpinner/>);
    }

    if (this.isManagingTranslationsLocked()) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i className='k-icon k-icon-alert'/>
            {t("Managing translations is not available due to form's Locking Profile restrictions.")}
          </bem.Loading__inner>
        </bem.Loading>
      );
    }

    let translations = this.state.translations;
    if (translations.length === 0) {
      return this.renderEmptyMessage();
    } else if (translations.length == 1 && translations[0] === null) {
      // use this modal if there are only unnamed translations
      return this.renderUndefinedDefaultSettings();
    } else {
      return this.renderTranslationsSettings(translations);
    }
  }
}

reactMixin(TranslationSettings.prototype, Reflux.ListenerMixin);

export default TranslationSettings;
