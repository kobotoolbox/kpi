import React from 'react'
import clonedeep from 'lodash.clonedeep';
import envStore from 'js/envStore'
import {formatTime} from 'js/utils'
import {AnyRowTypeName} from 'js/constants'
import singleProcessingStore from 'js/components/processing/singleProcessingStore'
import LanguageSelector from 'js/components/languages/languageSelector'
import Button from 'js/components/common/button'

interface TranscriptDraft {
  content?: string
  languageCode?: string
}

type TranscriptTabContentProps = {
  questionType: AnyRowTypeName | undefined
}

type TranscriptTabContentState = {
  transcriptDraft?: TranscriptDraft
}

export default class TranscriptTabContent extends React.Component<
  TranscriptTabContentProps,
  TranscriptTabContentState
> {
  constructor(props: TranscriptTabContentProps) {
    super(props)
    this.state = {}
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

  onSingleProcessingStoreChange() {
    /**
     * Don't want to store a duplicate of store data here just for the sake of
     * comparison, so we need to make the component re-render itself when the
     * store changes :shrug:.
     */
    this.forceUpdate()
  }

  /** Changes the draft language, preserving the other draft properties. */
  onLanguageChange(newVal: string | undefined) {
    const newDraft = clonedeep(this.state.transcriptDraft) || {}
    newDraft.languageCode = newVal
    this.setState({transcriptDraft: newDraft})
  }

  /** Changes the draft content, preserving the other draft properties. */
  setDraftContent(newVal: string | undefined) {
    const newDraft = clonedeep(this.state.transcriptDraft) || {}
    newDraft.content = newVal
    this.setState({transcriptDraft: newDraft})
  }

  onDraftContentChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftContent(evt.target.value)
  }

  onBegin() {
    // Make an empty draft.
    this.setState({transcriptDraft: {}})
  }

  onManualModeSelected() {
    // Initialize draft content.
    this.setDraftContent('')
  }

  onAutomaticModeSelected() {
    // TODO: this will display an automated service selector that will
    // ultimately produce a `transcriptDraft.content`.
  }

  onDiscardDraft() {
    // Remove draft.
    this.setState({transcriptDraft: undefined})
  }

  onSaveDraft() {
    if (
      this.state.transcriptDraft?.languageCode !== undefined &&
      this.state.transcriptDraft?.content !== undefined
    ) {
      singleProcessingStore.setTranscript({
        languageCode: this.state.transcriptDraft.languageCode,
        content: this.state.transcriptDraft.content,
        dateCreated: String(new Date())
      })
    }
  }

  onOpenEditor() {
    // Make new draft using existing transcript.
    this.setState({transcriptDraft: singleProcessingStore.getTranscript()})
  }

  onDeleteTranscript() {
    singleProcessingStore.setTranscript(undefined)
  }

  hasUnsavedDraftContent() {
    return (
      this.state.transcriptDraft?.content !== singleProcessingStore.getTranscript()?.content
    )
  }

  renderLanguageAndDate() {
    const storeTranscript = singleProcessingStore.getTranscript()
    const contentLanguageCode = this.state.transcriptDraft?.languageCode || storeTranscript?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    // If the draft/transcript language is custom (i.e. not known to envStore),
    // we just display the given value.
    const knownLanguage = envStore.getLanguage(contentLanguageCode)
    const languageLabel = knownLanguage?.label || contentLanguageCode

    return (
      <React.Fragment>
        {t('Language')} {languageLabel}

        {storeTranscript?.dateCreated &&
          t('Created ##date##').replace('##date##', formatTime(storeTranscript.dateCreated))
        }
      </React.Fragment>
    )
  }

  getLanguageSelectorTitle() {
    let typeLabel = this.props.questionType || t('source file')
    return t('Please selet the original language of the ##type##').replace('##type##', typeLabel)
  }

  renderStepBegin() {
    let typeLabel = this.props.questionType || t('source file')
    return (
      <div style={{padding: '40px'}}>
        {t('This ##type## does not have a transcript yet').replace('##type##', typeLabel)}
        <Button
          type='full'
          color='blue'
          size='m'
          label={t('begin')}
          onClick={this.onBegin.bind(this)}
        />
      </div>
    )
  }

  renderStepConfig() {
    return (
      <div style={{padding: '40px'}}>
        <LanguageSelector
          titleOverride={this.getLanguageSelectorTitle()}
          onLanguageChange={this.onLanguageChange.bind(this)}
        />

        <Button
          type='frame'
          color='blue'
          size='m'
          label={t('manual')}
          onClick={this.onManualModeSelected.bind(this)}
          isDisabled={this.state.transcriptDraft?.languageCode === undefined}
        />

        <Button
          type='full'
          color='blue'
          size='m'
          label={t('automatic')}
          onClick={this.onAutomaticModeSelected.bind(this)}
          // TODO: This is disabled until we actually work on automated services integration.
          isDisabled
        />
      </div>
    )
  }

  renderStepEditor() {
    return (
      <div style={{padding: '40px'}}>
        <div>
          {this.renderLanguageAndDate()}

          <Button
            type='frame'
            color='blue'
            size='s'
            label={t('Discard')}
            onClick={this.onDiscardDraft.bind(this)}
            isDisabled={!this.hasUnsavedDraftContent() || singleProcessingStore.isPending}
          />

          <Button
            type='full'
            color='blue'
            size='s'
            label={t('Save')}
            onClick={this.onSaveDraft.bind(this)}
            isPending={singleProcessingStore.isPending}
            isDisabled={!this.hasUnsavedDraftContent()}
          />
        </div>

        <textarea
          value={this.state.transcriptDraft?.content}
          onChange={this.onDraftContentChange.bind(this)}
          disabled={singleProcessingStore.isPending}
        />
      </div>
    )
  }

  renderStepViewer() {
    return (
      <div style={{padding: '40px'}}>
        <div>
          {this.renderLanguageAndDate()}

          <Button
            type='bare'
            color='gray'
            size='s'
            startIcon='edit'
            onClick={this.onOpenEditor.bind(this)}
            tooltip={t('Edit')}
            isDisabled={singleProcessingStore.isPending}
          />

          <Button
            type='bare'
            color='gray'
            size='s'
            startIcon='trash'
            onClick={this.onDeleteTranscript.bind(this)}
            tooltip={t('Delete')}
            isPending={singleProcessingStore.isPending}
          />
        </div>

        <textarea
          value={singleProcessingStore.getTranscript()?.content}
          readOnly
        />
      </div>
    )
  }

  /** Identifies what step should be displayed based on data itself. */
  render() {
    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranscript() === undefined &&
      this.state.transcriptDraft === undefined
    ) {
      return this.renderStepBegin()
    }

    // Step 2: Config - for selecting the transcript language and mode.
    if (
      this.state.transcriptDraft !== undefined &&
      (
        this.state.transcriptDraft.languageCode === undefined ||
        this.state.transcriptDraft.content === undefined
      )
    ) {
      return this.renderStepConfig()
    }

    // Step 3: Editor - display editor of draft transcript.
    if (this.state.transcriptDraft !== undefined) {
      return this.renderStepEditor()
    }

    // Step 4: Viewer - display existing (on backend) transcript.
    if (
      singleProcessingStore.getTranscript() !== undefined &&
      this.state.transcriptDraft === undefined
    ) {
      return this.renderStepViewer()
    }

    // Should not happen, but we need to return something.
    return null
  }
}
