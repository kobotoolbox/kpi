import React from 'react'
import clonedeep from 'lodash.clonedeep'
import Select from 'react-select'
import envStore from 'js/envStore'
import {formatTime} from 'js/utils'
import bem from 'js/bem'
import singleProcessingStore, {Translation} from 'js/components/processing/singleProcessingStore'
import LanguageSelector from 'js/components/languages/languageSelector'
import languageSelectorActions from 'js/components/languages/languageSelectorActions';
import Button from 'js/components/common/button'
import 'js/components/processing/processingBody'

type TranslationsTabContentProps = {}

type TranslationsTabContentState = {
  /** Uses languageCode. */
  selectedTranslation?: string
  /** Uses languageCode, useful for back button. */
  previousSelectedTranslation?: string
}

export default class TranslationsTabContent extends React.Component<
  TranslationsTabContentProps,
  TranslationsTabContentState
> {
  constructor(props: TranslationsTabContentProps) {
    super(props)

    // We want to always have a translation selected when there is at least one
    // so we preselect it on the initialization.
    let selected;
    const storedTranslations = singleProcessingStore.getTranslations()
    if (storedTranslations.length >= 1) {
      selected = storedTranslations[0].languageCode
    }

    this.state = {
      selectedTranslation: selected
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleProcessingStoreChange() {
    const draft = singleProcessingStore.getTranslationDraft()

    // When we save a new translation, we can preselect it, as it already exist
    // in the store.
    if (draft?.languageCode) {
      this.selectTranslation(draft.languageCode)
    }

    // When we delete a translation, we want to select another one.
    if (
      draft === undefined &&
      this.state.selectedTranslation !== undefined &&
      singleProcessingStore.getTranslation(this.state.selectedTranslation) === undefined
    ) {
      // We want to always have a translation selected when there is at least one
      // so we preselect it on the initialization.
      let selected;
      const storedTranslations = singleProcessingStore.getTranslations()
      if (storedTranslations.length >= 1) {
        selected = storedTranslations[0].languageCode
      }
      this.setState({selectedTranslation: selected})
    }

    this.forceUpdate()
  }

  /** Changes the draft language, preserving the other draft properties. */
  onLanguageChange(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranslationDraft()) || {}
    newDraft.languageCode = newVal
    singleProcessingStore.setTranslationDraft(newDraft)
  }

  /** Changes the draft value, preserving the other draft properties. */
  setDraftValue(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranslationDraft()) || {}
    newDraft.value = newVal
    singleProcessingStore.setTranslationDraft(newDraft)
  }

  onDraftValueChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftValue(evt.target.value)
  }

  begin() {
    // Make an empty draft.
    singleProcessingStore.setTranslationDraft({})
  }

  selectModeManual() {
    // Initialize draft value.
    this.setDraftValue('')
  }

  selectModeAuto() {
    // TODO: this will display an automated service selector that will
    // ultimately produce a draft value.
  }

  back() {
    const draft = singleProcessingStore.getTranslationDraft()

    if (
      draft !== undefined &&
      draft?.languageCode === undefined &&
      draft?.value === undefined
    ) {
      this.discardDraft()
    }

    if (
      draft !== undefined &&
      draft?.languageCode !== undefined &&
      draft?.value === undefined
    ) {
      singleProcessingStore.setTranslationDraft({})
      languageSelectorActions.resetAll()
    }
  }

  /** Removes the draft and preselects translations if possible. */
  discardDraft() {
    let preselectedTranslation = undefined
    if (this.state.previousSelectedTranslation) {
      preselectedTranslation = this.state.previousSelectedTranslation
    } else {
      const storedTranslations = singleProcessingStore.getTranslations()
      if (storedTranslations.length >= 1) {
        preselectedTranslation = storedTranslations[0].languageCode
      }
    }

    singleProcessingStore.setTranslationDraft(undefined)

    this.setState({
      selectedTranslation: preselectedTranslation,
      previousSelectedTranslation: undefined
    })
  }

  saveDraft() {
    const draft = singleProcessingStore.getTranslationDraft()
    const existingTranslation = singleProcessingStore.getTranslation(draft?.languageCode)

    const dateNow = new Date()
    const dateISO = dateNow.toISOString()

    if (
      draft?.languageCode !== undefined &&
      draft?.value !== undefined
    ) {
      singleProcessingStore.setTranslation(draft.languageCode, {
        languageCode: draft.languageCode,
        value: draft.value,
        dateCreated: existingTranslation?.dateCreated || dateISO,
        dateModified: dateISO
      })
    }
  }

  openEditor(languageCode: string) {
    // Make new draft using existing translation.
    singleProcessingStore.setTranslationDraft(
      singleProcessingStore.getTranslation(languageCode)
    )
    this.setState({
      selectedTranslation: languageCode
    })
  }

  deleteTranslation(languageCode: string) {
    singleProcessingStore.setTranslation(languageCode, undefined)
  }

  addTranslation() {
    // Make an empty draft to make the language selector appear. Unselect the current translation.
    singleProcessingStore.setTranslationDraft({})
    this.setState({
      selectedTranslation: undefined,
      previousSelectedTranslation: this.state.selectedTranslation
    })
  }

  selectTranslation(languageCode: string) {
    this.setState({selectedTranslation: languageCode})
  }

  getTranslationsLanguages() {
    const translations = singleProcessingStore.getTranslations()
    const languages: string[] = []
    translations.forEach((translation: Translation) => {
      languages.push(translation.languageCode)
    })
    return languages
  }

  renderLanguageAndDate() {
    const storeTranslation = singleProcessingStore.getTranslation(this.state.selectedTranslation)

    let dateText = ''
    if (storeTranslation) {
      if (storeTranslation.dateCreated !== storeTranslation?.dateModified) {
        dateText = t('last modified ##date##').replace('##date##', formatTime(storeTranslation.dateModified))
      } else {
        dateText = t('created ##date##').replace('##date##', formatTime(storeTranslation.dateCreated))
      }
    }

    return (
      <React.Fragment>
        {this.renderLanguage()}

        {dateText !== '' &&
          <bem.ProcessingBody__transHeaderDate>
            {dateText}
          </bem.ProcessingBody__transHeaderDate>
        }
      </React.Fragment>
    )
  }

  /** Renders a text or a selector of translations. */
  renderLanguage() {
    const draft = singleProcessingStore.getTranslationDraft()

    // When editing we want to display just a text
    if (draft?.languageCode) {
      return (
        <bem.ProcessingBody__transHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {envStore.getLanguageDisplayLabel(draft.languageCode)}
          </bem.ProcessingBody__transHeaderLanguage>
        </bem.ProcessingBody__transHeaderLanguageWrapper>
      )
    }

    const translations = singleProcessingStore.getTranslations()

    // When viewing the only translation we want to display just a text
    if (!draft && translations.length === 1) {
      return (
        <bem.ProcessingBody__transHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {envStore.getLanguageDisplayLabel(translations[0].languageCode)}
          </bem.ProcessingBody__transHeaderLanguage>
        </bem.ProcessingBody__transHeaderLanguageWrapper>
      )
    }

    // When viewing one of translations we want to have an option to select some
    // other translation.
    if (!draft && translations.length >= 2) {
      let selectValueLabel = this.state.selectedTranslation
      if (this.state.selectedTranslation) {
        selectValueLabel = envStore.getLanguageDisplayLabel(this.state.selectedTranslation)
      }

      const selectValue = {
        value: this.state.selectedTranslation,
        label: selectValueLabel
      }

      const selectOptions: {value: string, label: string}[] = []
      translations.forEach((translation: Translation) => {
        selectOptions.push({
          value: translation.languageCode,
          label: envStore.getLanguageDisplayLabel(translation.languageCode)
        })
      })

      // TODO: don't use Select because of styles issues, use KoboSelect
      return (
        <bem.ProcessingBody__transHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            <Select
              className='kobo-select'
              classNamePrefix='kobo-select'
              isSearchable={false}
              isClearable={false}
              inputId='translations-languages'
              value={selectValue}
              options={selectOptions}
              onChange={(newVal) => {newVal?.value && this.selectTranslation(newVal.value)}}
            />
          </bem.ProcessingBody__transHeaderLanguage>
        </bem.ProcessingBody__transHeaderLanguageWrapper>
      )
    }

    return null
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
    )
  }

  renderStepConfig() {
    const draft = singleProcessingStore.getTranslationDraft()

    return (
      <bem.ProcessingBody m='config'>
        <LanguageSelector
          titleOverride={t('Please selet the language you want to translate to')}
          onLanguageChange={this.onLanguageChange.bind(this)}
          sourceLanguage={singleProcessingStore.getSourceData()?.languageCode}
          hideLanguages={this.getTranslationsLanguages()}
        />

        <bem.ProcessingBody__footer>
          <Button
            type='bare'
            color='blue'
            size='m'
            label={t('back')}
            startIcon='caret-left'
            onClick={this.back.bind(this)}
          />

          <bem.ProcessingBody__footerRightButtons>
            <Button
              type='frame'
              color='blue'
              size='m'
              label={t('manual')}
              onClick={this.selectModeManual.bind(this)}
              isDisabled={draft?.languageCode === undefined}
            />

            <Button
              type='full'
              color='blue'
              size='m'
              label={t('automatic')}
              onClick={this.selectModeAuto.bind(this)}
              // TODO: This is disabled until we actually work on automated services integration.
              isDisabled
            />
          </bem.ProcessingBody__footerRightButtons>
        </bem.ProcessingBody__footer>
      </bem.ProcessingBody>
    )
  }

  renderStepEditor() {
    const draft = singleProcessingStore.getTranslationDraft()

    // The discard button will become a back button when there are no unsaved changes.
    let discardLabel = t('Back')
    if (singleProcessingStore.hasUnsavedTranslationDraftValue()) {
      discardLabel = t('Discard')
    }

    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transHeaderButtons>
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
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__textarea
          value={draft?.value}
          onChange={this.onDraftValueChange.bind(this)}
          disabled={singleProcessingStore.isFetchingData}
        />
      </bem.ProcessingBody>
    )
  }

  /** Displays an existing translation. */
  renderStepSingleViewer() {
    if (!this.state.selectedTranslation) {
      return null
    }

    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transHeaderButtons>
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
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__text>
          {singleProcessingStore.getTranslation(this.state.selectedTranslation)?.value}
        </bem.ProcessingBody__text>
      </bem.ProcessingBody>
    )
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    const draft = singleProcessingStore.getTranslationDraft()

    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranslations().length === 0 &&
      draft === undefined
    ) {
      return this.renderStepBegin()
    }

    // Step 2: Config - for selecting the translation language and mode.
    if (
      draft !== undefined &&
      (
        draft.languageCode === undefined ||
        draft.value === undefined
      )
    ) {
      return this.renderStepConfig()
    }

    // Step 3: Editor - display editor of draft translation.
    if (draft !== undefined) {
      return this.renderStepEditor()
    }

    // Step 4: Viewer - display existing (on backend) and selected translation.
    if (
      (
        singleProcessingStore.getTranslation(this.state.selectedTranslation) !== undefined ||
        singleProcessingStore.getTranslations().length >= 1
      ) &&
      draft === undefined
    ) {
      return this.renderStepSingleViewer()
    }

    // Should not happen, but we need to return something.
    return null
  }
}
