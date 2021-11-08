import React from 'react'
import clonedeep from 'lodash.clonedeep'
import envStore from 'js/envStore'
import {formatTime} from 'js/utils'
import bem from 'js/bem'
import singleProcessingStore from 'js/components/processing/singleProcessingStore'
import LanguageSelector from 'js/components/languages/languageSelector'
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
  translationDraft?: TranslationDraft
}

export default class TranslationsTabContent extends React.Component<
  TranslationsTabContentProps,
  TranslationsTabContentState
> {
  constructor(props: TranslationsTabContentProps) {
    super(props)

    // We want to avoid displaying a list of translations if there is only one,
    // so we preselect it on the initialization.
    let selected;
    const storedTranslations = singleProcessingStore.getTranslations()
    if (storedTranslations.length === 1) {
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

  discardDraft() {
    // Remove draft.
    this.setState({translationDraft: undefined})
  }

  saveDraft() {
    if (
      this.state.translationDraft?.languageCode !== undefined &&
      this.state.translationDraft?.content !== undefined
    ) {
      singleProcessingStore.setTranslation(this.state.translationDraft.languageCode, {
        languageCode: this.state.translationDraft.languageCode,
        content: this.state.translationDraft.content,
        dateCreated: Date()
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
      selectedTranslation: undefined
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
    const contentLanguageCode = this.state.translationDraft?.languageCode || storeTranslation?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    // If the draft/translation language is custom (i.e. not known to envStore),
    // we just display the given value.
    const knownLanguage = envStore.getLanguage(contentLanguageCode)
    const languageLabel = knownLanguage?.label || contentLanguageCode

    return (
      <React.Fragment>
        <div>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {languageLabel}
          </bem.ProcessingBody__transHeaderLanguage>
        </div>

        {storeTranslation?.dateCreated &&
          <bem.ProcessingBody__transHeaderDate>
            {t('Created ##date##').replace('##date##', formatTime(storeTranslation.dateCreated))}
          </bem.ProcessingBody__transHeaderDate>
        }
      </React.Fragment>
    )
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
              isDisabled={!this.hasUnsavedDraftContent() || singleProcessingStore.isPending}
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
              type='bare'
              color='gray'
              size='s'
              startIcon='edit'
              onClick={this.openEditor.bind(this, this.state.selectedTranslation)}
              tooltip={t('Edit')}
              isDisabled={singleProcessingStore.isPending}
            />

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

  renderStepList() {
    const translations = singleProcessingStore.getTranslations()

    return (
      <bem.ProcessingBody>
        <bem.SimpleTable>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>
                {t('language')}
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                {t('created date')}
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                {t('actions')}
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>

          <bem.SimpleTable__body>
            {translations.map((translation) => (
              <bem.SimpleTable__row>
                <bem.SimpleTable__cell>
                  {envStore.getLanguageDisplayLabel(translation.languageCode)}
                </bem.SimpleTable__cell>
                <bem.SimpleTable__cell>
                  {formatTime(translation.dateCreated)}
                </bem.SimpleTable__cell>
                <bem.SimpleTable__cell>
                  <bem.ProcessingBody__transHeaderButtons>
                    <Button
                      type='bare'
                      color='gray'
                      size='s'
                      startIcon='view'
                      onClick={this.selectTranslation.bind(this, translation.languageCode)}
                      tooltip={t('View')}
                      isDisabled={singleProcessingStore.isPending}
                    />

                    <Button
                      type='bare'
                      color='gray'
                      size='s'
                      startIcon='edit'
                      onClick={this.openEditor.bind(this, translation.languageCode)}
                      tooltip={t('Edit')}
                      isDisabled={singleProcessingStore.isPending}
                    />

                    <Button
                      type='bare'
                      color='gray'
                      size='s'
                      startIcon='trash'
                      onClick={this.deleteTranslation.bind(this, translation.languageCode)}
                      tooltip={t('Delete')}
                      isPending={singleProcessingStore.isPending}
                    />
                  </bem.ProcessingBody__transHeaderButtons>
                </bem.SimpleTable__cell>
              </bem.SimpleTable__row>
            ))}
          </bem.SimpleTable__body>
        </bem.SimpleTable>
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

    // Also to be used when there is only one translation on the backend to avoid displaying list with single item?
    if (
      (
        singleProcessingStore.getTranslation(this.state.selectedTranslation) !== undefined ||
        singleProcessingStore.getTranslations().length === 1
      ) &&
      this.state.translationDraft === undefined
    ) {
      return this.renderStepSingleViewer()
    }

    // Step 5: List - the step where there are multiple translations already.
    if (
      singleProcessingStore.getTranslations().length >= 2 &&
      this.state.translationDraft === undefined
    ) {
      return this.renderStepList()
    }

    // Should not happen, but we need to return something.
    return null
  }
}
