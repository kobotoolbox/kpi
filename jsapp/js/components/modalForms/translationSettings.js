import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import LanguageForm from 'js/components/modalForms/languageForm';
import bem from 'js/bem';
import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from 'js/stores';
import assetStore from 'js/assetStore';
import {actions} from 'js/actions';
import {MODAL_TYPES} from 'js/constants';
import {LockingRestrictionName} from 'js/components/locking/lockingConstants';
import {hasAssetRestriction} from 'js/components/locking/lockingUtils';
import envStore from 'js/envStore';
import {
  getLangString,
  notify,
  escapeHtml,
} from 'utils';
import pageState from 'js/pageState.store';
import Button from 'js/components/common/button';

const LANGUAGE_SUPPORT_URL = 'language_dashboard.html';

export class TranslationSettings extends React.Component {
  constructor(props) {
    super(props);

    let translations = [];
    if (
      props.asset &&
      props.asset.content &&
      props.asset.content.translations
    ) {
      translations = props.asset.content.translations;
    }

    this.state = {
      assetUid: props.assetUid,
      asset: props.asset,
      translations: translations,
      showAddLanguageForm: false,
      isUpdatingAsset: false,
      renameLanguageIndex: -1,
    };
    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(assetStore, this.onAssetsChange);

    if (this.state.asset && !this.state.asset.content) {
      stores.allAssets.whenLoaded(this.props.assetUid, this.onAssetChange);
      actions.resources.loadAsset({id: this.state.asset.uid});
    }

    if (!this.state.asset && this.state.assetUid) {
      if (assetStore.data[this.state.assetUid]) {
        this.onAssetChange(assetStore.data[this.state.assetUid]);
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
      isUpdatingAsset: false,
      renameLanguageIndex: -1,
    });

    pageState.showModal({
      type: MODAL_TYPES.FORM_LANGUAGES,
      asset: asset,
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
    this.setState({showAddLanguageForm: true});
  }
  hideAddLanguageForm() {
    this.setState({showAddLanguageForm: false});
  }
  toggleRenameLanguageForm(index) {
    if (this.state.renameLanguageIndex === index) {
      this.setState({renameLanguageIndex: -1});
    } else {
      this.setState({renameLanguageIndex: index});
    }
  }
  launchTranslationTableModal(index, langString) {
    pageState.switchModal({
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
  // Check if the default `null` language has been replaced yet
  canAddLanguages() {
    return !(
      this.state.translations.length === 1 &&
      this.state.translations[0] === null
    );
  }
  // `language_edit` restriction implies canAddLanguages but restricts it
  canEditLanguages() {
    return !this.isEditingLanguagesLocked() && this.canAddLanguages();
  }
  getAllLanguages() {
    return this.state.translations;
  }
  deleteLanguage(index) {
    const content = this.deleteTranslations(this.state.asset.content, index);
    if (content) {
      content.translations.splice(index, 1);
      const dialog = alertify.dialog('confirm');
      const opts = {
        title: t('Delete language?'),
        message: t(
          'Are you sure you want to delete this language? This action is not reversible.'
        ),
        labels: {ok: t('Delete'), cancel: t('Cancel')},
        onok: () => {
          this.updateAsset(content);
          dialog.destroy();
        },
        oncancel: dialog.destroy,
      };
      dialog.set(opts).show();
    } else {
      notify(t('Translation index mismatch. Cannot delete language.'), 'error');
    }
  }
  prepareTranslations(content) {
    let translated = content.translated;
    let translationsLength = content.translations.length;
    let survey = content.survey;
    let choices = content.choices;

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
    let translated = content.translated;
    let translationsLength = content.translations.length;
    let survey = content.survey;
    let choices = content.choices;

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
  changeDefaultLanguage(index) {
    const langString = this.state.translations[index];

    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Change default language?'),
      message: t(
        'Are you sure you would like to set ##lang## as the default language for this form?'
      ).replace('##lang##', escapeHtml(langString)),
      labels: {ok: t('Confirm'), cancel: t('Cancel')},
      onok: () => {
        const content = this.state.asset.content;
        content.settings.default_language = langString;
        this.updateAsset(content);
        dialog.destroy();
      },
      oncancel: dialog.destroy,
    };
    dialog.set(opts).show();
  }
  updateAsset(content) {
    this.setState({isUpdatingAsset: true});

    actions.resources.updateAsset(
      this.state.asset.uid,
      {content: JSON.stringify(content)},
      // reload asset on failure
      {
        onFailed: () => {
          actions.resources.loadAsset({id: this.state.asset.uid}, true);
          notify.error('failed to update translations');
        },
      }
    );
  }
  isEditingLanguagesLocked() {
    return (
      this.state.asset?.content &&
      hasAssetRestriction(
        this.state.asset.content,
        LockingRestrictionName.language_edit
      )
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
            <p>
              {t(
                'Here you can add more languages to your project, and translate the strings in each of them.'
              )}
            </p>
            <p>
              {t('For the language code field, we suggest using the')}
              <a
                target='_blank'
                href='https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry'
              >
                {' ' + t('official language code') + ' '}
              </a>
              {t('(e.g. "English (en)" or "Rohingya (rhg)").')}

              {envStore.isReady &&
                envStore.data.support_url && (
                  <a
                    target='_blank'
                    href={
                      envStore.data.support_url +
                      LANGUAGE_SUPPORT_URL
                    }
                  >
                    {' ' + t('Read more.')}
                  </a>
                )}
            </p>
          </bem.FormView__cell>
          <bem.FormView__cell m='translation'>
            <p>
              <strong>
                {t(
                  'Please name your default language before adding languages and translations.'
                )}
              </strong>
            </p>
          </bem.FormView__cell>
          <bem.FormView__cell m='update-language-form'>
            <LanguageForm
              isPending={this.state.isUpdatingAsset}
              onLanguageChange={this.onLanguageChange.bind(this)}
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
          {translations[0] === null && (
            <InlineMessage
              type='warning'
              icon='alert'
              message={t('You have named translations in your form but the default translation is unnamed. Please specifiy a default translation or make an existing one default.')}
            />
          )}
          {translations.map((l, i) =>
            (
              <React.Fragment key={`lang-${i}`}>
                <bem.FormView__cell m='translation'>
                  <bem.FormView__cell m='translation-name'>
                    {l}

                    {i === 0 && (
                      <bem.FormView__label m='default-language'>
                        {t('default')}
                      </bem.FormView__label>
                    )}

                    {i !== 0 && (
                      <Button
                        type='text'
                        size='m'
                        onClick={() => {this.changeDefaultLanguage(i);}}
                        isDisabled={
                          this.state.isUpdatingAsset ||
                          !this.canEditLanguages()
                        }
                        tooltip={t('Make default')}
                        startIcon='language-default'
                      />
                    )}
                  </bem.FormView__cell>

                  <bem.FormView__cell m='translation-actions'>
                    <Button
                      type='secondary'
                      size='m'
                      onClick={() => {this.toggleRenameLanguageForm(i);}}
                      isDisabled={
                        this.state.isUpdatingAsset ||
                        !this.canEditLanguages()
                      }
                      startIcon={this.state.renameLanguageIndex === i ? 'close': 'edit'}
                      tooltip={t('Edit language')}
                      tooltipPosition='right'
                    />

                    <Button
                      type='secondary'
                      size='m'
                      onClick={() => {
                        this.launchTranslationTableModal(
                          i,
                          this.state.translations[i]
                        );
                      }}
                      isDisabled={this.state.isUpdatingAsset}
                      startIcon='language-settings'
                      tooltip={t('Update translations')}
                      tooltipPosition='right'
                    />

                    {i !== 0 && (
                      <Button
                        type='secondary-danger'
                        size='m'
                        onClick={() => {this.deleteLanguage(i);}}
                        isDisabled={
                          this.state.isUpdatingAsset ||
                          !this.canEditLanguages()
                        }
                        startIcon='trash'
                        tooltip={t('Delete language')}
                        tooltipPosition='right'
                      />
                    )}
                  </bem.FormView__cell>
                </bem.FormView__cell>

                {this.state.renameLanguageIndex === i && (
                  <bem.FormView__cell m='update-language-form'>
                    <LanguageForm
                      isPending={this.state.isUpdatingAsset}
                      langString={l}
                      langIndex={i}
                      onLanguageChange={this.onLanguageChange.bind(this)}
                      existingLanguages={this.getAllLanguages(l)}
                    />
                  </bem.FormView__cell>
                )}
              </React.Fragment>
            )
          )}
          {!this.state.showAddLanguageForm && (
            <bem.FormView__cell m='add-language'>
              <Button
                type='primary'
                size='l'
                onClick={this.showAddLanguageForm.bind(this)}
                isDisabled={!this.canAddLanguages() || !this.canEditLanguages()}
                label={t('Add language')}
              />
            </bem.FormView__cell>
          )}
          {this.state.showAddLanguageForm && (
            <bem.FormView__cell m='add-language-form'>
              <Button
                className='add-language-form-close'
                type='text'
                size='m'
                onClick={this.hideAddLanguageForm.bind(this)}
                startIcon='close'
              />

              <bem.FormView__cell m='label'>
                {t('Add a new language')}
              </bem.FormView__cell>

              <LanguageForm
                isPending={this.state.isUpdatingAsset}
                onLanguageChange={this.onLanguageChange.bind(this)}
                existingLanguages={this.getAllLanguages()}
              />
            </bem.FormView__cell>
          )}
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
      return <LoadingSpinner />;
    }

    let translations = this.state.translations;
    if (translations.length === 0) {
      return this.renderEmptyMessage();
    } else if (translations.length === 1 && translations[0] === null) {
      // use this modal if there are only unnamed translations
      return this.renderUndefinedDefaultSettings();
    } else {
      return this.renderTranslationsSettings(translations);
    }
  }
}

reactMixin(TranslationSettings.prototype, Reflux.ListenerMixin);

export default TranslationSettings;
