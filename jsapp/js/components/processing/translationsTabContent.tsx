import React from 'react';
import clonedeep from 'lodash.clonedeep';
import envStore from 'js/envStore';
import {formatTime} from 'js/utils';
import bem from 'js/bem';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import LanguageSelector from 'js/components/languages/languageSelector';
import languageSelectorActions from 'js/components/languages/languageSelectorActions';
import Button from 'js/components/common/button';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import KoboSelect from 'js/components/common/koboSelect';
import 'js/components/processing/processingBody';
import {destroyConfirm} from 'js/alertify';

interface TranslationsTabContentState {
  /** Uses languageCode. */
  selectedTranslation?: string;
}

export default class TranslationsTabContent extends React.Component<
  {},
  TranslationsTabContentState
> {
  constructor(props: {}) {
    super(props);

    this.state = {
      // We want to always have a translation selected when there is at least
      // one, so we preselect it on the initialization.
      selectedTranslation: this.getDefaultSelectedTranslation(),
    };
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleProcessingStoreChange() {
    const draft = singleProcessingStore.getTranslationDraft();

    // When we save a new translation, we can preselect it, as it already exist
    // in the store.
    if (draft?.languageCode) {
      this.selectTranslation(draft.languageCode);
    }

    // When the selected translation was removed, we select another one.
    if (
      draft === undefined &&
      singleProcessingStore.getTranslation(this.state.selectedTranslation) === undefined
    ) {
      this.selectTranslation(this.getDefaultSelectedTranslation());
    }

    this.forceUpdate();
  }

  /** Changes the draft language, preserving the other draft properties. */
  onLanguageChange(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    newDraft.languageCode = newVal;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  getDefaultSelectedTranslation() {
    let selected;
    const storedTranslations = singleProcessingStore.getTranslations();
    if (storedTranslations.length >= 1) {
      selected = storedTranslations[0].languageCode;
    }
    return selected;
  }

  /** Changes the draft value, preserving the other draft properties. */
  setDraftValue(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    newDraft.value = newVal;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  onDraftValueChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftValue(evt.target.value);
  }

  begin() {
    // Make an empty draft.
    singleProcessingStore.setTranslationDraft({});
  }

  selectModeManual() {
    // Initialize draft value.
    this.setDraftValue('');
  }

  selectModeAuto() {
    // Currently we only support automatic translation from transcript language,
    // but we should also allow to use the source data language.
    const languageCode = singleProcessingStore.getTranslationDraft()?.languageCode;
    if (languageCode) {
      singleProcessingStore.requestAutoTranslation(languageCode);
    }
  }

  back() {
    const draft = singleProcessingStore.getTranslationDraft();

    if (
      draft !== undefined &&
      draft?.languageCode === undefined &&
      draft?.value === undefined
    ) {
      this.discardDraft();
    }

    if (
      draft !== undefined &&
      draft?.languageCode !== undefined &&
      draft?.value === undefined
    ) {
      singleProcessingStore.setTranslationDraft({});
      languageSelectorActions.resetAll();
    }
  }

  /** Removes the draft and preselects translations if possible. */
  discardDraft() {
    if (singleProcessingStore.hasUnsavedTranslationDraftValue()) {
      destroyConfirm(
        this.discardDraftInnerMethod.bind(this),
        t('Discard unsaved changes?'),
        t('Discard')
      );
    } else {
      this.discardDraftInnerMethod();
    }
  }

  discardDraftInnerMethod() {
    singleProcessingStore.deleteTranslationDraft();
  }

  saveDraft() {
    const draft = singleProcessingStore.getTranslationDraft();

    if (
      draft?.languageCode !== undefined &&
      draft?.value !== undefined
    ) {
      singleProcessingStore.setTranslation(
        draft.languageCode,
        draft.value
      );
    }
  }

  openEditor(languageCode: string) {
    const translation = singleProcessingStore.getTranslation(languageCode);

    if (translation) {
      // Make new draft using existing translation.
      singleProcessingStore.setTranslationDraft(translation);
      this.setState({
        selectedTranslation: languageCode,
      });
    }
  }

  deleteTranslation(languageCode: string) {
    destroyConfirm(
      singleProcessingStore.deleteTranslation.bind(
        singleProcessingStore,
        languageCode
      ),
      t('Delete ##language name## translation?').replace(
        '##language name##',
        envStore.getLanguageDisplayLabel(languageCode)
      )
    );
  }

  addTranslation() {
    // Make an empty draft to make the language selector appear. Unselect the current translation.
    singleProcessingStore.setTranslationDraft({});
  }

  selectTranslation(languageCode?: string) {
    this.setState({selectedTranslation: languageCode});
  }

  /** Returns languages of all translations */
  getTranslationsLanguages() {
    const translations = singleProcessingStore.getTranslations();
    const languages: string[] = [];
    translations.forEach((translation) => {
      languages.push(translation.languageCode);
    });
    return languages;
  }

  renderLanguageAndDate() {
    const storeTranslation = singleProcessingStore.getTranslation(this.state.selectedTranslation);

    let dateText = '';
    if (storeTranslation) {
      if (storeTranslation.dateCreated !== storeTranslation?.dateModified) {
        dateText = t('last modified ##date##').replace('##date##', formatTime(storeTranslation.dateModified));
      } else {
        dateText = t('created ##date##').replace('##date##', formatTime(storeTranslation.dateCreated));
      }
    }

    return (
      <React.Fragment>
        {this.renderLanguage()}

        {dateText !== '' &&
          <bem.ProcessingBody__transxHeaderDate>
            {dateText}
          </bem.ProcessingBody__transxHeaderDate>
        }
      </React.Fragment>
    );
  }

  /** Renders a text or a selector of translations. */
  renderLanguage() {
    const draft = singleProcessingStore.getTranslationDraft();

    // When editing we want to display just a text
    if (draft?.languageCode) {
      return (
        <bem.ProcessingBody__transxHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transxHeaderLanguage>
            {envStore.getLanguageDisplayLabel(draft.languageCode)}
          </bem.ProcessingBody__transxHeaderLanguage>
        </bem.ProcessingBody__transxHeaderLanguageWrapper>
      );
    }

    const translations = singleProcessingStore.getTranslations();

    // When viewing the only translation we want to display just a text
    if (!draft && translations.length === 1) {
      return (
        <bem.ProcessingBody__transxHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transxHeaderLanguage>
            {envStore.getLanguageDisplayLabel(translations[0].languageCode)}
          </bem.ProcessingBody__transxHeaderLanguage>
        </bem.ProcessingBody__transxHeaderLanguageWrapper>
      );
    }

    // When viewing one of translations we want to have an option to select some
    // other translation.
    if (!draft && translations.length >= 2) {
      const selectOptions: KoboSelectOption[] = [];
      translations.forEach((translation) => {
        selectOptions.push({
          id: translation.languageCode,
          label: envStore.getLanguageDisplayLabel(translation.languageCode),
        });
      });

      return (
        <bem.ProcessingBody__transxHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transxHeaderLanguage>
            <KoboSelect
              name='translation-header-language-switcher'
              type='blue'
              size='s'
              selectedOption={this.state.selectedTranslation ? this.state.selectedTranslation : null}
              options={selectOptions}
              onChange={(newSelectedOption: string) => {
                this.selectTranslation(newSelectedOption);
              }}
            />
          </bem.ProcessingBody__transxHeaderLanguage>
        </bem.ProcessingBody__transxHeaderLanguageWrapper>
      );
    }

    return null;
  }

  renderStepBegin() {
    return (
      <bem.ProcessingBody m='begin'>
        <p>{t('This transcript does not have any translations yet')}</p>

        <Button
          type='full'
          color='blue'
          size='m'
          label={t('begin')}
          onClick={this.begin.bind(this)}
        />
      </bem.ProcessingBody>
    );
  }

  renderStepConfig() {
    const draft = singleProcessingStore.getTranslationDraft();

    return (
      <bem.ProcessingBody m='config'>
        <LanguageSelector
          titleOverride={t('Please select the language you want to translate to')}
          onLanguageChange={this.onLanguageChange.bind(this)}
          sourceLanguage={singleProcessingStore.getSourceData()?.languageCode}
          hiddenLanguages={this.getTranslationsLanguages()}
          suggestedLanguages={singleProcessingStore.getAssetTranslatableLanguages()}
          isDisabled={singleProcessingStore.isFetchingData}
        />

        <bem.ProcessingBody__footer>
          <Button
            type='bare'
            color='blue'
            size='m'
            label={t('back')}
            startIcon='caret-left'
            onClick={this.back.bind(this)}
            isDisabled={singleProcessingStore.isFetchingData}
          />

          <bem.ProcessingBody__footerRightButtons>
            <Button
              type='frame'
              color='blue'
              size='m'
              label={t('manual')}
              onClick={this.selectModeManual.bind(this)}
              isDisabled={draft?.languageCode === undefined || singleProcessingStore.isFetchingData}
            />

            <Button
              type='full'
              color='blue'
              size='m'
              label={t('automatic')}
              onClick={this.selectModeAuto.bind(this)}
              isDisabled={draft?.languageCode === undefined}
              isPending={singleProcessingStore.isFetchingData}
            />
          </bem.ProcessingBody__footerRightButtons>
        </bem.ProcessingBody__footer>
      </bem.ProcessingBody>
    );
  }

  renderStepEditor() {
    const draft = singleProcessingStore.getTranslationDraft();

    // The discard button will become a back button when there are no unsaved changes.
    let discardLabel = t('Back');
    if (singleProcessingStore.hasUnsavedTranslationDraftValue()) {
      discardLabel = t('Discard');
    }

    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transxHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transxHeaderButtons>
            <Button
              type='frame'
              color='blue'
              size='s'
              label={discardLabel}
              onClick={this.discardDraft.bind(this)}
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='full'
              color='blue'
              size='s'
              label={t('Save')}
              onClick={this.saveDraft.bind(this)}
              isPending={singleProcessingStore.isFetchingData}
              isDisabled={!singleProcessingStore.hasUnsavedTranslationDraftValue()}
            />
          </bem.ProcessingBody__transxHeaderButtons>
        </bem.ProcessingBody__transxHeader>

        <bem.ProcessingBody__textarea
          value={draft?.value}
          onChange={this.onDraftValueChange.bind(this)}
          disabled={singleProcessingStore.isFetchingData}
        />
      </bem.ProcessingBody>
    );
  }

  /** Displays an existing translation. */
  renderStepSingleViewer() {
    if (!this.state.selectedTranslation) {
      return null;
    }

    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transxHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transxHeaderButtons>
            <Button
              type='frame'
              color='storm'
              size='s'
              startIcon='plus'
              label={t('new translation')}
              onClick={this.addTranslation.bind(this)}
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='edit'
              onClick={this.openEditor.bind(this, this.state.selectedTranslation)}
              tooltip={t('Edit')}
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='trash'
              onClick={this.deleteTranslation.bind(this, this.state.selectedTranslation)}
              tooltip={t('Delete')}
              isPending={singleProcessingStore.isFetchingData}
            />
          </bem.ProcessingBody__transxHeaderButtons>
        </bem.ProcessingBody__transxHeader>

        <bem.ProcessingBody__text>
          {singleProcessingStore.getTranslation(this.state.selectedTranslation)?.value}
        </bem.ProcessingBody__text>
      </bem.ProcessingBody>
    );
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    const draft = singleProcessingStore.getTranslationDraft();

    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranslations().length === 0 &&
      draft === undefined
    ) {
      return this.renderStepBegin();
    }

    // Step 2: Config - for selecting the translation language and mode.
    if (
      draft !== undefined &&
      (
        draft.languageCode === undefined ||
        draft.value === undefined
      )
    ) {
      return this.renderStepConfig();
    }

    // Step 3: Editor - display editor of draft translation.
    if (draft !== undefined) {
      return this.renderStepEditor();
    }

    // Step 4: Viewer - display existing (on backend) and selected translation.
    if (
      (
        singleProcessingStore.getTranslation(this.state.selectedTranslation) !== undefined ||
        singleProcessingStore.getTranslations().length >= 1
      ) &&
      draft === undefined
    ) {
      return this.renderStepSingleViewer();
    }

    // Should not happen, but we need to return something.
    return null;
  }
}
