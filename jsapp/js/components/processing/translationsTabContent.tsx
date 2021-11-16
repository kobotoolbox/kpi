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

interface TranslationDraft {
  content?: string
  languageCode?: string
}

type TranslationsTabContentProps = {}

type TranslationsTabContentState = {
  /** Uses languageCode. */
  selectedTranslation?: string
  /** Uses languageCode, useful for back button. */
  previousSelectedTranslation?: string
  translationDraft?: TranslationDraft
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
    // When we save a new translation, we can preselect it, as it already exist
    // in the store.
    if (this.state.translationDraft?.languageCode) {
      this.selectTranslation(this.state.translationDraft.languageCode)
    }

    // When we delete a translation, we want to select another one.
    if (
      this.state.translationDraft === undefined &&
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
    const newDraft = clonedeep(this.state.translationDraft) || {}
    newDraft.languageCode = newVal
    this.setState({translationDraft: newDraft})
  }

  /** Changes the draft content, preserving the other draft properties. */
  setDraftContent(newVal: string | undefined) {
    const newDraft = clonedeep(this.state.translationDraft) || {}
    newDraft.content = newVal
    this.setState({translationDraft: newDraft})
  }

  onDraftContentChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftContent(evt.target.value)
  }

  begin() {
    // Make an empty draft.
    this.setState({translationDraft: {}})
  }

  selectModeManual() {
    // Initialize draft content.
    this.setDraftContent('')
  }

  selectModeAuto() {
    // TODO: this will display an automated service selector that will
    // ultimately produce a `translationDraft.content`.
  }

  back() {
    if (
      this.state.translationDraft !== undefined &&
      this.state.translationDraft?.languageCode === undefined &&
      this.state.translationDraft?.content === undefined
    ) {
      this.discardDraft()
    }

    if (
      this.state.translationDraft !== undefined &&
      this.state.translationDraft?.languageCode !== undefined &&
      this.state.translationDraft?.content === undefined
    ) {
      this.setState({translationDraft: {}}, languageSelectorActions.resetAll)
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

    this.setState({
      translationDraft: undefined,
      selectedTranslation: preselectedTranslation,
      previousSelectedTranslation: undefined
    })
  }

  saveDraft() {
    const existingTranslation = singleProcessingStore.getTranslation(this.state.translationDraft?.languageCode)

    if (
      this.state.translationDraft?.languageCode !== undefined &&
      this.state.translationDraft?.content !== undefined
    ) {
      singleProcessingStore.setTranslation(this.state.translationDraft.languageCode, {
        languageCode: this.state.translationDraft.languageCode,
        content: this.state.translationDraft.content,
        dateCreated: existingTranslation?.dateCreated || Date(),
        dateModified: Date()
      })
    }
  }

  openEditor(languageCode: string) {
    // Make new draft using existing translation.
    this.setState({
      translationDraft: singleProcessingStore.getTranslation(languageCode),
      selectedTranslation: languageCode
    })
  }

  deleteTranslation(languageCode: string) {
    singleProcessingStore.setTranslation(languageCode, undefined)
  }

  addTranslation() {
    // Make an empty draft to make the language selector appear. Unselect the current translation.
    this.setState({
      translationDraft: {},
      selectedTranslation: undefined,
      previousSelectedTranslation: this.state.selectedTranslation
    })
  }

  hasUnsavedDraftContent() {
    return (
      this.state.translationDraft?.content !== singleProcessingStore.getTranslation(this.state.translationDraft?.languageCode)?.content
    )
  }

  selectTranslation(languageCode: string) {
    this.setState({selectedTranslation: languageCode})
  }

  renderLanguageAndDate() {
    const storeTranslation = singleProcessingStore.getTranslation(this.state.selectedTranslation)

    let dateText = ''
    if (storeTranslation) {
      if (storeTranslation.dateCreated !== storeTranslation?.dateModified) {
        dateText = t('Modified ##date##').replace('##date##', formatTime(storeTranslation.dateModified))
      } else {
        dateText = t('Created ##date##').replace('##date##', formatTime(storeTranslation.dateCreated))
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
    // When editing we want to display just a text
    if (this.state.translationDraft?.languageCode) {
      return (
        <bem.ProcessingBody__transHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {envStore.getLanguageDisplayLabel(this.state.translationDraft.languageCode)}
          </bem.ProcessingBody__transHeaderLanguage>
        </bem.ProcessingBody__transHeaderLanguageWrapper>
      )
    }

    const translations = singleProcessingStore.getTranslations()

    // When viewing the only translation we want to display just a text
    if (!this.state.translationDraft && translations.length === 1) {
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
    if (!this.state.translationDraft && translations.length >= 2) {
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

      // TODO: don't use Select because of styles issues, use KoboDropdown
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
    return (
      <bem.ProcessingBody m='config'>
        <LanguageSelector
          titleOverride={t('Please selet the language you want to translate to')}
          onLanguageChange={this.onLanguageChange.bind(this)}
          /* TODO this needs to be the selected aside content language, so might be other translation */
          sourceLanguage={singleProcessingStore.getTranscript()?.languageCode}
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

          <div>
            <Button
              type='frame'
              color='blue'
              size='m'
              label={t('manual')}
              onClick={this.selectModeManual.bind(this)}
              isDisabled={this.state.translationDraft?.languageCode === undefined}
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
          </div>
        </bem.ProcessingBody__footer>
      </bem.ProcessingBody>
    )
  }

  renderStepEditor() {
    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transHeaderButtons>
            <Button
              type='frame'
              color='blue'
              size='s'
              label={t('Discard')}
              onClick={this.discardDraft.bind(this)}
              isDisabled={singleProcessingStore.isPending}
            />

            <Button
              type='full'
              color='blue'
              size='s'
              label={t('Save')}
              onClick={this.saveDraft.bind(this)}
              isPending={singleProcessingStore.isPending}
              isDisabled={!this.hasUnsavedDraftContent()}
            />
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__textarea
          value={this.state.translationDraft?.content}
          onChange={this.onDraftContentChange.bind(this)}
          disabled={singleProcessingStore.isPending}
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
              color='gray'
              size='s'
              startIcon='plus'
              label={t('new translation')}
              onClick={this.addTranslation.bind(this)}
              isDisabled={singleProcessingStore.isPending}
            />

            <Button
              type='bare'
              color='gray'
              size='s'
              startIcon='edit'
              onClick={this.openEditor.bind(this, this.state.selectedTranslation)}
              tooltip={t('Edit')}
              isDisabled={singleProcessingStore.isPending}
            />

            <Button
              type='bare'
              color='gray'
              size='s'
              startIcon='trash'
              onClick={this.deleteTranslation.bind(this, this.state.selectedTranslation)}
              tooltip={t('Delete')}
              isPending={singleProcessingStore.isPending}
            />
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__text>
          {singleProcessingStore.getTranslation(this.state.selectedTranslation)?.content}
        </bem.ProcessingBody__text>
      </bem.ProcessingBody>
    )
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranslations().length === 0 &&
      this.state.translationDraft === undefined
    ) {
      return this.renderStepBegin()
    }

    // Step 2: Config - for selecting the translation language and mode.
    if (
      this.state.translationDraft !== undefined &&
      (
        this.state.translationDraft.languageCode === undefined ||
        this.state.translationDraft.content === undefined
      )
    ) {
      return this.renderStepConfig()
    }

    // Step 3: Editor - display editor of draft translation.
    if (this.state.translationDraft !== undefined) {
      return this.renderStepEditor()
    }

    // Step 4: Viewer - display existing (on backend) and selected translation.
    if (
      (
        singleProcessingStore.getTranslation(this.state.selectedTranslation) !== undefined ||
        singleProcessingStore.getTranslations().length >= 1
      ) &&
      this.state.translationDraft === undefined
    ) {
      return this.renderStepSingleViewer()
    }

    // Should not happen, but we need to return something.
    return null
  }
}
